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

import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import requests
from pydantic_settings import BaseSettings, SettingsConfigDict
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Add current directory to path for service imports
sys.path.insert(0, os.path.dirname(__file__))

from services import users, cases, helpers, guides


class AppSettings(BaseSettings):
    """Central configuration loaded from .env / environment."""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    team_id: str
    api_token: str
    bedrock_endpoint: str = "https://ctwa92wg1b.execute-api.us-east-1.amazonaws.com/prod/invoke"


settings = AppSettings()

TEAM_ID = settings.team_id
API_TOKEN = settings.api_token
API_ENDPOINT = settings.bedrock_endpoint

MODELS = {
    "recommended": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    "fast": "us.anthropic.claude-3-5-haiku-20241022-v1:0",
    "powerful": "us.anthropic.claude-3-opus-20240229-v1:0",
    "llama_large": "us.meta.llama3-2-90b-instruct-v1:0",
    "mistral_large": "us.mistral.pixtral-large-2502-v1:0"
}

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


class ChatMessage(BaseModel):
    """Message schema for forwarding to the Bedrock relay."""

    role: Literal["system", "user", "assistant", "tool"] = "user"
    content: str


class InvokeRequest(BaseModel):
    """Payload accepted by the LLM relay endpoint."""

    model: str = Field(
        default="recommended",
        description="Either a key from MODELS or a fully-qualified model identifier."
    )
    messages: List[ChatMessage] = Field(..., description="Conversation history in Claude format")
    max_tokens: int = Field(default=256, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    extra_parameters: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional raw parameters merged into the Bedrock payload."
    )


# ============================================================================
# EXTERNAL API RELAY HELPERS
# ============================================================================

def get_api_session() -> requests.Session:
    """Create a Bedrock session with authentication headers."""

    if not TEAM_ID or not API_TOKEN:
        raise ValueError("TEAM_ID or API_TOKEN not found. Please check your .env file.")

    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "X-Team-ID": TEAM_ID,
        "X-API-Token": API_TOKEN
    })
    return session


def _resolve_model_name(model_choice: str) -> str:
    """Map shorthand keys to fully qualified model identifiers."""

    return MODELS.get(model_choice, model_choice)


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
# LLM RELAY ENDPOINT
# ============================================================================

@app.post("/api/llm/invoke")
def invoke_bedrock(request: InvokeRequest) -> Dict[str, Any]:
    """Forward payload to the hackathon Bedrock endpoint."""

    payload: Dict[str, Any] = {
        "team_id": TEAM_ID,
        "api_token": API_TOKEN,
        "model": _resolve_model_name(request.model),
        "messages": [message.model_dump() for message in request.messages],
        "max_tokens": request.max_tokens,
        "temperature": request.temperature,
    }

    if request.extra_parameters:
        payload.update(request.extra_parameters)

    try:
        session = get_api_session()
    except ValueError as config_err:
        raise HTTPException(status_code=500, detail=str(config_err)) from config_err

    try:
        response = session.post(API_ENDPOINT, json=payload, timeout=60)
        response.raise_for_status()
    except requests.exceptions.HTTPError as http_err:
        raise HTTPException(
            status_code=response.status_code,
            detail={
                "message": "Upstream Bedrock API returned an error",
                "response_text": response.text,
            }
        ) from http_err
    except requests.exceptions.RequestException as req_err:
        raise HTTPException(status_code=502, detail=str(req_err)) from req_err

    return response.json()


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
