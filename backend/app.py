"""
BEACON Backend API

FastAPI application implementing the full emergency response coordination system.

Endpoints:
- User & Location: POST /api/users/location-consent
- Caller Flow: POST /api/cases, GET /api/cases/{id}/caller-guide
- Helper Flow: GET /api/cases/nearby, GET /api/helpers/nearby, POST /api/assignments
- Guides: GET /api/assignments/{id}/helper-guide
- Routing: GET /api/cases/{case_id}/route
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import sys
import os
import logging
from uuid import uuid4
from datetime import datetime, timedelta

# LangSmith client for observability
from langsmith import Client

# Add current directory to path for service imports
sys.path.insert(0, os.path.dirname(__file__))

from services import users, cases, helpers, guides, messages
from voice.routes import router as voice_router

# Create FastAPI app
app = FastAPI(
    title="BEACON Emergency Response API",
    description="AI-powered emergency coordination connecting helpers with people in need",
    version="1.0.0"
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("beacon_api")

# Import from main for LangSmith config
from main import LANGSMITH_PROJECT, LANGSMITH_API_KEY

# Initialize LangSmith client for feedback/metrics
ls_client = Client()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register voice routes
app.include_router(voice_router)


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class LocationConsentRequest(BaseModel):
    user_id: Optional[str] = Field(None, description="UUID (None to generate new)")
    latitude: float = Field(..., description="Current latitude")
    longitude: float = Field(..., description="Current longitude")
    name: Optional[str] = Field(None, description="User's name")
    contact_info: Optional[str] = Field(None, description="Phone/email")
    is_helper: bool = Field(False, description="True if helper, False if caller")
    helper_skills: Optional[List[str]] = Field(None, description="Skills if helper")
    helper_max_range: Optional[int] = Field(None, description="Max range in meters")


class CreateCaseRequest(BaseModel):
    user_id: Optional[str] = Field(None, description="UUID of caller")
    latitude: float = Field(..., description="Incident latitude")
    longitude: float = Field(..., description="Incident longitude")
    raw_problem_description: str = Field(..., description="User's raw text")
    emergency_id: Optional[int] = Field(None, description="Emergency ID if known")


class CreateAssignmentRequest(BaseModel):
    case_id: int = Field(..., description="Case to assign to")
    helper_user_id: int = Field(..., description="Helper claiming case")
    notes: Optional[str] = Field(None, description="Optional notes")


class CompleteAssignmentRequest(BaseModel):
    outcome: str = Field(..., description="Outcome description")
    notes: Optional[str] = Field(None, description="Completion notes")


class CreateMessageRequest(BaseModel):
    assignment_id: int = Field(..., description="Assignment ID")
    case_id: int = Field(..., description="Case ID")
    sender: str = Field(..., description="helper_agent, victim_agent, helper_user, or victim_user")
    message_type: str = Field(..., description="question, answer, status_update, or guidance")
    message_text: str = Field(..., description="Message content")
    options: Optional[List[dict]] = Field(None, description="Button options for questions")
    question_type: Optional[str] = Field(None, description="single or multiple")
    in_response_to: Optional[int] = Field(None, description="Message ID responding to")


class MarkMessagesReadRequest(BaseModel):
    message_ids: List[int] = Field(..., description="List of message IDs to mark as read")


# ============================================================================
# USER & LOCATION ENDPOINTS
# ============================================================================

@app.post("/api/users/location-consent")
def location_consent(request: LocationConsentRequest):
    """
    Create or update user with location consent.

    Entry point for both caller and helper flows.
    Generates UUID if not provided, stores location in users table,
    and logs to location_tracking.
    """
    try:
        result = users.create_or_update_user_location(
            user_id=request.user_id,
            latitude=request.latitude,
            longitude=request.longitude,
            name=request.name,
            contact_info=request.contact_info,
            is_helper=request.is_helper,
            helper_skills=request.helper_skills,
            helper_max_range=request.helper_max_range
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/users/{user_id}")
def get_user(user_id: str):
    """Get user by ID."""
    try:
        user = users.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/users/{user_id}/location-history")
def get_location_history(user_id: str, limit: int = Query(100, ge=1, le=1000)):
    """Get location tracking history for a user."""
    try:
        history = users.get_user_location_history(user_id, limit=limit)
        return {"user_id": user_id, "locations": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CASE ENDPOINTS (Caller Flow)
# ============================================================================

@app.post("/api/cases", status_code=201)
def create_case(request: CreateCaseRequest):
    """
    Create new case (caller bootstrap).

    Immediately creates case row with raw text,
    then triggers InputProcessingAgent asynchronously to populate
    structured fields and generate caller guide.
    
    Returns case with run_id for LangSmith tracing.
    """
    try:
        # Generate a unique run ID for LangSmith tracing
        run_id = str(uuid4())
        
        # Metadata for LangSmith filtering
        metadata = {
            "endpoint": "/api/cases",
            "caller_user_id": request.user_id,
            "location": [request.latitude, request.longitude],
            "input_length": len(request.raw_problem_description),
            "emergency_id": request.emergency_id,
        }
        
        logger.info(f"Creating case with run_id={run_id}", extra={"metadata": metadata})
        
        result = cases.create_case(
            user_id=request.user_id,
            latitude=request.latitude,
            longitude=request.longitude,
            raw_problem_description=request.raw_problem_description,
            emergency_id=request.emergency_id
        )
        
        # Attach run_id to response for client to use in feedback
        result["run_id"] = run_id
        
        logger.info(f"Case created: {result.get('id')} with run_id={run_id}")
        
        return result
    except Exception as e:
        logger.error(f"Case creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/cases/nearby")
def get_nearby_cases(
    lat: float = Query(..., description="Helper latitude"),
    lon: float = Query(..., description="Helper longitude"),
    radius: float = Query(10.0, ge=0.1, le=100, description="Radius in km")
):
    """
    Get cases near helper location (for helper map view).

    Returns open cases with distance, urgency, and assignment info.
    """
    try:
        nearby = cases.get_nearby_cases(
            latitude=lat,
            longitude=lon,
            radius_km=radius
        )
        return {"cases": nearby, "count": len(nearby)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/cases/{case_id}")
def get_case(case_id: int):
    """Get case by ID with full details."""
    try:
        case = cases.get_case(case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        return case
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/cases/{case_id}/caller-guide")
def get_caller_guide(case_id: int):
    """
    Get AI-generated caller guide for a case.

    Returns 3 bullet points with immediate actions for victim.
    May return null if guide not yet generated (async processing).
    """
    try:
        guide = guides.get_caller_guide(case_id)
        if not guide:
            return {
                "case_id": case_id,
                "status": "processing",
                "message": "Guide is being generated. Please check back in a few seconds."
            }
        return guide
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HELPER ENDPOINTS
# ============================================================================

@app.get("/api/helpers/nearby")
def get_nearby_helpers_endpoint(
    lat: float = Query(..., description="Case latitude"),
    lon: float = Query(..., description="Case longitude"),
    radius: float = Query(10.0, ge=0.1, le=100, description="Radius in km"),
    skills: Optional[str] = Query(None, description="Comma-separated skills")
):
    """
    Get helpers near case location (for caller map view).

    Returns active helpers with distance, skills, and latest location.
    Updates in real-time as helpers move (location_tracking polling).
    """
    try:
        required_skills = skills.split(",") if skills else None
        nearby = helpers.get_nearby_helpers(
            latitude=lat,
            longitude=lon,
            radius_km=radius,
            required_skills=required_skills
        )
        return {"helpers": nearby, "count": len(nearby)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/assignments", status_code=201)
def create_assignment(request: CreateAssignmentRequest):
    """
    Create assignment (helper claims case).

    Validates case is open and helper not already assigned.
    Updates case status to 'assigned'.
    Triggers HelperGuideAgent asynchronously.
    """
    try:
        result = helpers.create_assignment(
            case_id=request.case_id,
            helper_user_id=request.helper_user_id,
            notes=request.notes
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/assignments/{assignment_id}")
def get_assignment(assignment_id: int):
    """Get assignment by ID."""
    try:
        assignment = helpers.get_assignment(assignment_id)
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        return assignment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/assignments/case/{case_id}")
def get_case_assignments(case_id: int):
    """Get all assignments for a case (for victims to see who's responding)."""
    try:
        assignments = helpers.get_assignments_for_case(case_id=case_id)
        return {"assignments": assignments, "count": len(assignments)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/assignments/helper/{helper_user_id}")
def get_helper_assignments(
    helper_user_id: int,
    include_completed: bool = Query(False, description="Include completed assignments")
):
    """Get all assignments for a helper."""
    try:
        assignments = helpers.get_assignments_for_helper(
            helper_user_id=helper_user_id,
            include_completed=include_completed
        )
        return {"assignments": assignments, "count": len(assignments)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/assignments/{assignment_id}/complete")
def complete_assignment(assignment_id: int, request: CompleteAssignmentRequest):
    """
    Mark assignment as completed.

    Updates case status to 'resolved' if all assignments completed.
    """
    try:
        result = helpers.complete_assignment(
            assignment_id=assignment_id,
            outcome=request.outcome,
            notes=request.notes
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/assignments/{assignment_id}/helper-guide")
def get_helper_guide_endpoint(assignment_id: int):
    """
    Get AI-generated helper guide for an assignment.

    Returns 3 bullet points with actionable steps for responder.
    May return null if guide not yet generated (async processing).
    """
    try:
        guide = guides.get_helper_guide(assignment_id)
        if not guide:
            return {
                "assignment_id": assignment_id,
                "status": "processing",
                "message": "Guide is being generated. Please check back in a few seconds."
            }
        return guide
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ROUTING ENDPOINT (Google Maps Integration)
# ============================================================================

@app.get("/api/cases/{case_id}/route")
def get_route_to_case(
    case_id: int,
    helper_id: int = Query(..., description="Helper user ID"),
    helper_lat: float = Query(..., description="Helper current latitude"),
    helper_lon: float = Query(..., description="Helper current longitude")
):
    """
    Get route from helper to case location.

    Integrates with Google Directions API.
    Returns polyline, ETA, and distance.

    NOTE: Google Maps integration requires API key in environment.
    This is a placeholder that returns direct distance.
    """
    try:
        case = cases.get_case(case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")

        case_lat = case['location']['latitude']
        case_lon = case['location']['longitude']

        # Calculate direct distance (Haversine)
        from math import radians, sin, cos, asin, sqrt
        R = 6371  # Earth radius in km

        lat1, lon1, lat2, lon2 = map(radians, [helper_lat, helper_lon, case_lat, case_lon])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
        c = 2*asin(sqrt(a))
        distance_km = R * c

        # Estimate ETA (assume 30 km/h average in emergency)
        eta_minutes = int((distance_km / 30) * 60)

        return {
            "case_id": case_id,
            "helper_id": helper_id,
            "from": {"latitude": helper_lat, "longitude": helper_lon},
            "to": {"latitude": case_lat, "longitude": case_lon},
            "distance_km": round(distance_km, 2),
            "eta_minutes": eta_minutes,
            "polyline": None,  # TODO: Integrate Google Directions API
            "note": "Direct distance calculation. Google Maps integration pending."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# AGENT MESSAGES ENDPOINTS (Bidirectional Communication)
# ============================================================================

@app.post("/api/messages", status_code=201)
def create_message(request: CreateMessageRequest):
    """
    Create a new agent message (helper → victim or victim → helper).

    Enables bidirectional communication during an active assignment.
    Messages can be questions, answers, status updates, or guidance.
    """
    try:
        result = messages.create_message(
            assignment_id=request.assignment_id,
            case_id=request.case_id,
            sender=request.sender,
            message_type=request.message_type,
            message_text=request.message_text,
            options=request.options,
            question_type=request.question_type,
            in_response_to=request.in_response_to
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/assignments/{assignment_id}/messages")
def get_assignment_messages(
    assignment_id: int,
    sender_filter: Optional[str] = Query(None, description="Filter by sender type"),
    limit: int = Query(100, ge=1, le=500)
):
    """
    Get all messages for an assignment (conversation history).

    Returns messages in chronological order.
    Optionally filter by sender type.
    """
    try:
        msgs = messages.get_messages(
            assignment_id=assignment_id,
            sender_filter=sender_filter,
            limit=limit
        )
        return {"assignment_id": assignment_id, "messages": msgs, "count": len(msgs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/assignments/{assignment_id}/messages/unread")
def get_unread_messages_endpoint(
    assignment_id: int,
    for_sender: str = Query(..., description="helper_agent or victim_agent")
):
    """
    Get unread messages for a specific recipient.

    Used for polling: helper polls for victim messages, victim polls for helper messages.
    Returns only messages sent by the OTHER party.
    """
    try:
        msgs = messages.get_unread_messages(
            assignment_id=assignment_id,
            for_sender=for_sender
        )
        return {"assignment_id": assignment_id, "unread_messages": msgs, "count": len(msgs)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/assignments/{assignment_id}/messages/latest-question")
def get_latest_question_endpoint(
    assignment_id: int,
    for_sender: str = Query(..., description="helper_agent or victim_agent")
):
    """
    Get the latest unanswered question from the other party.

    Useful for displaying pending questions that need a response.
    """
    try:
        question = messages.get_latest_question(
            assignment_id=assignment_id,
            for_sender=for_sender
        )
        if not question:
            return {"assignment_id": assignment_id, "question": None}
        return {"assignment_id": assignment_id, "question": question}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/messages/mark-read")
def mark_messages_read_endpoint(request: MarkMessagesReadRequest):
    """
    Mark messages as read.

    Updates read_by_recipient flag and sets read_at timestamp.
    """
    try:
        count = messages.mark_as_read(message_ids=request.message_ids)
        return {"marked_as_read": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# LANGSMITH OBSERVABILITY ENDPOINTS
# ============================================================================

@app.post("/api/feedback")
async def log_feedback(run_id: str, score: float, comment: Optional[str] = None):
    """
    Log user feedback (thumbs up/down) to LangSmith.
    Used by frontend to rate case handling quality.

    Args:
        run_id: The LangSmith run ID to attach feedback to
        score: Score value (1.0 = thumbs up, 0.0 = thumbs down)
        comment: Optional feedback comment
    """
    try:
        ls_client.create_feedback(
            run_id=run_id,
            key="user_rating",
            score=score,  # 1.0 = thumbs up, 0.0 = thumbs down
            comment=comment,
        )
        logger.info(f"Feedback logged for run {run_id}: score={score}")
        return {"status": "feedback_logged", "run_id": run_id}
    except Exception as e:
        logger.error(f"Feedback logging failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics")
async def get_metrics(hours: int = Query(1, ge=1, le=24)):
    """
    Return aggregated metrics from LangSmith for demo dashboard.
    Shows performance optimization and robustness.

    Args:
        hours: Number of hours to look back (default 1, max 24)

    Returns:
        Aggregated metrics including success rate, latency, token usage, cost estimates
    """
    try:
        # Get runs from specified time window
        recent_runs = ls_client.list_runs(
            project_name=LANGSMITH_PROJECT,
            start_time=datetime.now() - timedelta(hours=hours),
            limit=1000,
        )

        runs = list(recent_runs)

        if not runs:
            return {
                "time_window_hours": hours,
                "total_runs": 0,
                "error": "No runs found in specified time window"
            }

        # Aggregate metrics
        total_runs = len(runs)
        successful = sum(1 for r in runs if r.status == "success")
        failed = sum(1 for r in runs if r.status == "error")
        avg_latency = sum(r.latency or 0 for r in runs) / total_runs if total_runs > 0 else 0

        # Token usage (if available in metadata)
        total_tokens = 0
        for r in runs:
            if r.metadata and "token_usage" in r.metadata:
                total_tokens += r.metadata["token_usage"]

        # Calculate cost estimate (approximate for Claude 3.5 Haiku input tokens)
        cost_estimate = (total_tokens / 1000) * 0.003

        logger.info(f"Metrics query: {total_runs} runs in {hours}h, {successful} successful")

        return {
            "time_window_hours": hours,
            "total_runs": total_runs,
            "successful": successful,
            "failed": failed,
            "success_rate": successful / total_runs if total_runs > 0 else 0,
            "avg_latency_seconds": avg_latency,
            "total_tokens": total_tokens,
            "cost_estimate_usd": round(cost_estimate, 4),
            "cost_per_run_usd": round(cost_estimate / total_runs, 6) if total_runs > 0 else 0,
        }
    except Exception as e:
        logger.error(f"Metrics query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tool-usage")
async def get_tool_usage(hours: int = Query(24, ge=1, le=168)):
    """
    Get tool usage statistics from LangSmith runs.

    Args:
        hours: Number of hours to look back (default 24, max 168/1 week)

    Returns:
        Dictionary of tool names to usage counts
    """
    try:
        # Get runs from specified time window
        recent_runs = ls_client.list_runs(
            project_name=LANGSMITH_PROJECT,
            start_time=datetime.now() - timedelta(hours=hours),
            limit=1000,
        )

        runs = list(recent_runs)

        # Count tool usage across all runs
        tool_usage = {}

        for run in runs:
            # Get the run's name which often indicates the tool/function called
            if run.name:
                tool_name = run.name
                tool_usage[tool_name] = tool_usage.get(tool_name, 0) + 1

            # Also check for tool calls in the run's metadata
            if run.extra and isinstance(run.extra, dict):
                if 'tools' in run.extra:
                    tools = run.extra.get('tools', [])
                    if isinstance(tools, list):
                        for tool in tools:
                            tool_usage[tool] = tool_usage.get(tool, 0) + 1

        logger.info(f"Tool usage query: {len(tool_usage)} unique tools tracked")

        return {
            "time_window_hours": hours,
            "tool_usage": tool_usage,
            "total_tools": len(tool_usage),
            "total_calls": sum(tool_usage.values())
        }
    except Exception as e:
        logger.error(f"Tool usage query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/agent-runs")
async def get_recent_agent_runs(limit: int = Query(10, ge=1, le=50)):
    """
    Get recent agent runs with detailed action information.

    Args:
        limit: Number of most recent runs to return (default 10, max 50)

    Returns:
        List of agent runs with actions, inputs, outputs, and timing
    """
    try:
        # Get recent runs
        recent_runs = ls_client.list_runs(
            project_name=LANGSMITH_PROJECT,
            limit=limit,
        )

        runs_data = []

        for run in recent_runs:
            # Get child runs (actions/steps within the agent)
            child_runs = list(ls_client.list_runs(
                project_name=LANGSMITH_PROJECT,
                parent_run_id=run.id,
            ))

            actions = []
            for child in child_runs:
                action = {
                    "id": str(child.id),
                    "timestamp": child.start_time.isoformat() if child.start_time else None,
                    "action": child.name or "unknown",
                    "input": child.inputs or {},
                    "output": child.outputs or {},
                    "status": "success" if child.status == "success" else "error" if child.error else "running",
                    "duration": child.latency if child.latency else None,
                    "toolName": child.run_type or None,
                }
                actions.append(action)

            run_data = {
                "runId": str(run.id),
                "timestamp": run.start_time.isoformat() if run.start_time else None,
                "agentType": run.name or "Agent",
                "status": "completed" if run.status == "success" else "failed" if run.error else "running",
                "actions": actions,
                "totalDuration": run.latency if run.latency else None,
            }
            runs_data.append(run_data)

        logger.info(f"Agent runs query: {len(runs_data)} runs returned")

        return {
            "runs": runs_data,
            "count": len(runs_data)
        }
    except Exception as e:
        logger.error(f"Agent runs query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics/detailed")
async def get_detailed_metrics(hours: int = Query(24, ge=1, le=168)):
    """
    Get detailed metrics with latency breakdowns for each agent run.

    Returns:
        - Per-run latency breakdown (DB time, LLM time, total time)
        - Tool-level statistics (execution count, avg latency)
        - Database query statistics
        - LLM call statistics
    """
    try:
        recent_runs = ls_client.list_runs(
            project_name=LANGSMITH_PROJECT,
            start_time=datetime.now() - timedelta(hours=hours),
            limit=1000,
        )

        runs = list(recent_runs)

        if not runs:
            return {
                "time_window_hours": hours,
                "total_runs": 0,
                "message": "No runs found"
            }

        # Aggregate detailed metrics
        tool_latencies = {}
        db_queries = []
        llm_calls = []
        run_breakdowns = []

        for run in runs:
            # Get child runs for this run
            children = list(ls_client.list_runs(
                project_name=LANGSMITH_PROJECT,
                parent_run_id=run.id,
            ))

            db_time = 0
            llm_time = 0
            tool_times = {}

            for child in children:
                latency = child.latency or 0

                # Categorize by run name
                if child.name == "database_query":
                    db_time += latency
                    db_queries.append({
                        "parent_run": run.name,
                        "latency_ms": round(latency * 1000, 2),
                        "timestamp": child.start_time.isoformat() if child.start_time else None
                    })
                elif "Agent" in child.name or "LLM" in child.name.upper():
                    llm_time += latency
                    llm_calls.append({
                        "agent": child.name,
                        "latency_ms": round(latency * 1000, 2),
                        "timestamp": child.start_time.isoformat() if child.start_time else None
                    })

                # Track tool-specific latencies
                tool_name = child.name
                if tool_name not in tool_latencies:
                    tool_latencies[tool_name] = {"count": 0, "total_time": 0, "avg_time": 0}

                tool_latencies[tool_name]["count"] += 1
                tool_latencies[tool_name]["total_time"] += latency

            # Add run breakdown
            total_latency = run.latency or 0
            other_time = max(0, total_latency - db_time - llm_time)

            run_breakdowns.append({
                "run_id": str(run.id),
                "name": run.name,
                "total_latency_ms": round(total_latency * 1000, 2),
                "db_time_ms": round(db_time * 1000, 2),
                "llm_time_ms": round(llm_time * 1000, 2),
                "other_time_ms": round(other_time * 1000, 2),
                "db_percentage": round((db_time / total_latency * 100), 1) if total_latency > 0 else 0,
                "llm_percentage": round((llm_time / total_latency * 100), 1) if total_latency > 0 else 0,
                "timestamp": run.start_time.isoformat() if run.start_time else None
            })

        # Calculate averages for tools
        for tool_name, stats in tool_latencies.items():
            stats["avg_time_ms"] = round((stats["total_time"] / stats["count"]) * 1000, 2) if stats["count"] > 0 else 0
            stats["total_time_ms"] = round(stats["total_time"] * 1000, 2)
            del stats["total_time"]  # Remove seconds version

        logger.info(f"Detailed metrics: {len(runs)} runs analyzed")

        return {
            "time_window_hours": hours,
            "total_runs": len(runs),
            "run_breakdowns": run_breakdowns[-20:],  # Last 20 runs
            "tool_statistics": tool_latencies,
            "database_queries": {
                "total_count": len(db_queries),
                "avg_latency_ms": round(sum(q["latency_ms"] for q in db_queries) / len(db_queries), 2) if db_queries else 0,
                "recent_queries": db_queries[-10:]  # Last 10
            },
            "llm_calls": {
                "total_count": len(llm_calls),
                "avg_latency_ms": round(sum(c["latency_ms"] for c in llm_calls) / len(llm_calls), 2) if llm_calls else 0,
                "recent_calls": llm_calls[-10:]  # Last 10
            }
        }
    except Exception as e:
        logger.error(f"Detailed metrics query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/workflow-graph/{run_id}")
async def get_workflow_graph(run_id: str):
    """
    Get workflow graph data for visualization.
    Returns nodes and edges representing the agent execution flow.
    """
    try:
        # Get the main run
        run = ls_client.read_run(run_id)

        if not run:
            raise HTTPException(status_code=404, detail="Run not found")

        # Get all child runs
        children = list(ls_client.list_runs(
            project_name=LANGSMITH_PROJECT,
            parent_run_id=run_id,
        ))

        # Build nodes
        nodes = [{
            "id": str(run.id),
            "type": "agent",
            "label": run.name or "Agent",
            "status": run.status,
            "latency_ms": round((run.latency or 0) * 1000, 2),
            "timestamp": run.start_time.isoformat() if run.start_time else None
        }]

        # Build edges
        edges = []

        for i, child in enumerate(children):
            node_type = "database" if child.name == "database_query" else "tool" if "tool" in child.name.lower() else "llm"

            nodes.append({
                "id": str(child.id),
                "type": node_type,
                "label": child.name,
                "status": child.status,
                "latency_ms": round((child.latency or 0) * 1000, 2),
                "timestamp": child.start_time.isoformat() if child.start_time else None,
                "inputs": child.inputs,
                "outputs": child.outputs
            })

            edges.append({
                "id": f"edge-{i}",
                "source": str(run.id),
                "target": str(child.id),
                "label": f"{round((child.latency or 0) * 1000, 1)}ms"
            })

        return {
            "run_id": run_id,
            "run_name": run.name,
            "nodes": nodes,
            "edges": edges
        }
    except Exception as e:
        logger.error(f"Workflow graph query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "BEACON API"}


@app.get("/")
def root():
    """Root endpoint with API info."""
    return {
        "service": "BEACON Emergency Response API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "operational"
    }


# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
