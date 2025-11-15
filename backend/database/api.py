"""
FastAPI application with all CRUD endpoints
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from config import settings
from models import (
    UserCreate, UserUpdate, UserResponse,
    LocationTrackingCreate, LocationTrackingResponse,
    EmergencyCreate, EmergencyUpdate, EmergencyResponse,
    CaseGroupCreate, CaseGroupUpdate, CaseGroupResponse,
    CaseCreate, CaseUpdate, CaseResponse,
    AssignmentCreate, AssignmentUpdate, AssignmentResponse,
    UpdateCreate, UpdateResponse,
    ResearchReportCreate, ResearchReportResponse
)

import crud_users
import crud_emergencies
import crud_coordination

app = FastAPI(title=settings.api_title, version=settings.api_version)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# USERS ENDPOINTS
# ============================================================================

@app.post("/users", response_model=UserResponse, status_code=201)
def create_user(user: UserCreate):
    """Create a new user"""
    return crud_users.create_user(user)


@app.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int):
    """Get a user by ID"""
    user = crud_users.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.get("/users", response_model=List[UserResponse])
def get_users(skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=1000)):
    """Get all users with pagination"""
    return crud_users.get_users(skip=skip, limit=limit)


@app.put("/users/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user: UserUpdate):
    """Update a user by ID"""
    updated_user = crud_users.update_user(user_id, user)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    return updated_user


@app.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int):
    """Delete a user by ID"""
    if not crud_users.delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")


# ============================================================================
# LOCATION TRACKING ENDPOINTS
# ============================================================================

@app.post("/location-tracking", response_model=LocationTrackingResponse, status_code=201)
def create_location_tracking(tracking: LocationTrackingCreate):
    """Create a new location tracking entry"""
    return crud_users.create_location_tracking(tracking)


@app.get("/location-tracking/{tracking_id}", response_model=LocationTrackingResponse)
def get_location_tracking(tracking_id: int):
    """Get a location tracking entry by ID"""
    tracking = crud_users.get_location_tracking(tracking_id)
    if not tracking:
        raise HTTPException(status_code=404, detail="Location tracking not found")
    return tracking


@app.get("/location-tracking/user/{user_id}", response_model=List[LocationTrackingResponse])
def get_location_tracking_by_user(user_id: int, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=1000)):
    """Get all location tracking entries for a user"""
    return crud_users.get_location_tracking_by_user(user_id, skip=skip, limit=limit)


@app.delete("/location-tracking/{tracking_id}", status_code=204)
def delete_location_tracking(tracking_id: int):
    """Delete a location tracking entry by ID"""
    if not crud_users.delete_location_tracking(tracking_id):
        raise HTTPException(status_code=404, detail="Location tracking not found")


# ============================================================================
# EMERGENCIES ENDPOINTS
# ============================================================================

@app.post("/emergencies", response_model=EmergencyResponse, status_code=201)
def create_emergency(emergency: EmergencyCreate):
    """Create a new emergency"""
    return crud_emergencies.create_emergency(emergency)


@app.get("/emergencies/{emergency_id}", response_model=EmergencyResponse)
def get_emergency(emergency_id: int):
    """Get an emergency by ID"""
    emergency = crud_emergencies.get_emergency(emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")
    return emergency


@app.get("/emergencies", response_model=List[EmergencyResponse])
def get_emergencies(skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=1000)):
    """Get all emergencies with pagination"""
    return crud_emergencies.get_emergencies(skip=skip, limit=limit)


@app.put("/emergencies/{emergency_id}", response_model=EmergencyResponse)
def update_emergency(emergency_id: int, emergency: EmergencyUpdate):
    """Update an emergency by ID"""
    updated_emergency = crud_emergencies.update_emergency(emergency_id, emergency)
    if not updated_emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")
    return updated_emergency


@app.delete("/emergencies/{emergency_id}", status_code=204)
def delete_emergency(emergency_id: int):
    """Delete an emergency by ID"""
    if not crud_emergencies.delete_emergency(emergency_id):
        raise HTTPException(status_code=404, detail="Emergency not found")


# ============================================================================
# CASE GROUPS ENDPOINTS
# ============================================================================

@app.post("/case-groups", response_model=CaseGroupResponse, status_code=201)
def create_case_group(case_group: CaseGroupCreate):
    """Create a new case group"""
    return crud_emergencies.create_case_group(case_group)


@app.get("/case-groups/{case_group_id}", response_model=CaseGroupResponse)
def get_case_group(case_group_id: int):
    """Get a case group by ID"""
    case_group = crud_emergencies.get_case_group(case_group_id)
    if not case_group:
        raise HTTPException(status_code=404, detail="Case group not found")
    return case_group


@app.get("/case-groups/emergency/{emergency_id}", response_model=List[CaseGroupResponse])
def get_case_groups_by_emergency(emergency_id: int, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=1000)):
    """Get all case groups for an emergency"""
    return crud_emergencies.get_case_groups_by_emergency(emergency_id, skip=skip, limit=limit)


@app.put("/case-groups/{case_group_id}", response_model=CaseGroupResponse)
def update_case_group(case_group_id: int, case_group: CaseGroupUpdate):
    """Update a case group by ID"""
    updated_case_group = crud_emergencies.update_case_group(case_group_id, case_group)
    if not updated_case_group:
        raise HTTPException(status_code=404, detail="Case group not found")
    return updated_case_group


@app.delete("/case-groups/{case_group_id}", status_code=204)
def delete_case_group(case_group_id: int):
    """Delete a case group by ID"""
    if not crud_emergencies.delete_case_group(case_group_id):
        raise HTTPException(status_code=404, detail="Case group not found")


# ============================================================================
# CASES ENDPOINTS
# ============================================================================

@app.post("/cases", response_model=CaseResponse, status_code=201)
def create_case(case: CaseCreate):
    """Create a new case"""
    return crud_emergencies.create_case(case)


@app.get("/cases/{case_id}", response_model=CaseResponse)
def get_case(case_id: int):
    """Get a case by ID"""
    case = crud_emergencies.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@app.get("/cases", response_model=List[CaseResponse])
def get_cases(skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=1000)):
    """Get all cases with pagination"""
    return crud_emergencies.get_cases(skip=skip, limit=limit)


@app.put("/cases/{case_id}", response_model=CaseResponse)
def update_case(case_id: int, case: CaseUpdate):
    """Update a case by ID"""
    updated_case = crud_emergencies.update_case(case_id, case)
    if not updated_case:
        raise HTTPException(status_code=404, detail="Case not found")
    return updated_case


@app.delete("/cases/{case_id}", status_code=204)
def delete_case(case_id: int):
    """Delete a case by ID"""
    if not crud_emergencies.delete_case(case_id):
        raise HTTPException(status_code=404, detail="Case not found")


# ============================================================================
# ASSIGNMENTS ENDPOINTS
# ============================================================================

@app.post("/assignments", response_model=AssignmentResponse, status_code=201)
def create_assignment(assignment: AssignmentCreate):
    """Create a new assignment"""
    return crud_coordination.create_assignment(assignment)


@app.get("/assignments/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(assignment_id: int):
    """Get an assignment by ID"""
    assignment = crud_coordination.get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


@app.get("/assignments/case/{case_id}", response_model=List[AssignmentResponse])
def get_assignments_by_case(case_id: int, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=1000)):
    """Get all assignments for a case"""
    return crud_coordination.get_assignments_by_case(case_id, skip=skip, limit=limit)


@app.get("/assignments/helper/{helper_user_id}", response_model=List[AssignmentResponse])
def get_assignments_by_helper(helper_user_id: int, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=1000)):
    """Get all assignments for a helper"""
    return crud_coordination.get_assignments_by_helper(helper_user_id, skip=skip, limit=limit)


@app.put("/assignments/{assignment_id}", response_model=AssignmentResponse)
def update_assignment(assignment_id: int, assignment: AssignmentUpdate):
    """Update an assignment by ID"""
    updated_assignment = crud_coordination.update_assignment(assignment_id, assignment)
    if not updated_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return updated_assignment


@app.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: int):
    """Delete an assignment by ID"""
    if not crud_coordination.delete_assignment(assignment_id):
        raise HTTPException(status_code=404, detail="Assignment not found")


# ============================================================================
# UPDATES ENDPOINTS
# ============================================================================

@app.post("/updates", response_model=UpdateResponse, status_code=201)
def create_update(update: UpdateCreate):
    """Create a new update"""
    return crud_coordination.create_update(update)


@app.get("/updates/{update_id}", response_model=UpdateResponse)
def get_update(update_id: int):
    """Get an update by ID"""
    update = crud_coordination.get_update(update_id)
    if not update:
        raise HTTPException(status_code=404, detail="Update not found")
    return update


@app.get("/updates/emergency/{emergency_id}", response_model=List[UpdateResponse])
def get_updates_by_emergency(emergency_id: int, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=1000)):
    """Get all updates for an emergency"""
    return crud_coordination.get_updates_by_emergency(emergency_id, skip=skip, limit=limit)


@app.get("/updates/case/{case_id}", response_model=List[UpdateResponse])
def get_updates_by_case(case_id: int, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=1000)):
    """Get all updates for a case"""
    return crud_coordination.get_updates_by_case(case_id, skip=skip, limit=limit)


@app.delete("/updates/{update_id}", status_code=204)
def delete_update(update_id: int):
    """Delete an update by ID"""
    if not crud_coordination.delete_update(update_id):
        raise HTTPException(status_code=404, detail="Update not found")


# ============================================================================
# RESEARCH REPORTS ENDPOINTS
# ============================================================================

@app.post("/research-reports", response_model=ResearchReportResponse, status_code=201)
def create_research_report(report: ResearchReportCreate):
    """Create a new research report"""
    return crud_coordination.create_research_report(report)


@app.get("/research-reports/{report_id}", response_model=ResearchReportResponse)
def get_research_report(report_id: int):
    """Get a research report by ID"""
    report = crud_coordination.get_research_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Research report not found")
    return report


@app.get("/research-reports", response_model=List[ResearchReportResponse])
def get_research_reports(skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=1000)):
    """Get all research reports with pagination"""
    return crud_coordination.get_research_reports(skip=skip, limit=limit)


@app.delete("/research-reports/{report_id}", status_code=204)
def delete_research_report(report_id: int):
    """Delete a research report by ID"""
    if not crud_coordination.delete_research_report(report_id):
        raise HTTPException(status_code=404, detail="Research report not found")


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
