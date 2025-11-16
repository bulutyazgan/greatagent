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

# Add current directory to path for service imports
sys.path.insert(0, os.path.dirname(__file__))

from services import users, cases, helpers, guides, messages

# Create FastAPI app
app = FastAPI(
    title="BEACON Emergency Response API",
    description="AI-powered emergency coordination connecting helpers with people in need",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    """
    try:
        result = cases.create_case(
            user_id=request.user_id,
            latitude=request.latitude,
            longitude=request.longitude,
            raw_problem_description=request.raw_problem_description,
            emergency_id=request.emergency_id
        )
        return result
    except Exception as e:
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
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
