"""
Helper Management Service

Handles:
- Finding nearby helpers
- Creating assignments (helper claims case)
- Helper-specific queries
- Assignment lifecycle management
"""

import sys
import os
from typing import Dict, Optional, List
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database.db import get_db_cursor


def get_nearby_helpers(
    latitude: float,
    longitude: float,
    radius_km: float = 10.0,
    required_skills: Optional[List[str]] = None
) -> List[Dict]:
    """
    Get helpers near a location.

    Uses latest location from location_tracking for each helper.
    Only returns active helpers with helper_skills populated.

    Args:
        latitude: Case latitude
        longitude: Case longitude
        radius_km: Search radius in kilometers
        required_skills: Filter by skills (e.g., ['medical', 'first_aid'])

    Returns:
        List of helpers with distance, skills, latest location
    """
    radius_meters = radius_km * 1000

    with get_db_cursor(commit=False) as cursor:
        # Get latest location for each helper with Haversine distance
        query = """
            WITH latest_locations AS (
                SELECT DISTINCT ON (user_id)
                    user_id,
                    location,
                    timestamp
                FROM location_tracking
                ORDER BY user_id, timestamp DESC
            )
            SELECT
                u.id, u.name, u.contact_info, u.helper_skills, u.helper_max_range,
                ll.location, ll.timestamp,
                (
                    6371000 * acos(
                        cos(radians(%s)) *
                        cos(radians(ST_Y(ll.location::geometry))) *
                        cos(radians(ST_X(ll.location::geometry)) - radians(%s)) +
                        sin(radians(%s)) *
                        sin(radians(ST_Y(ll.location::geometry)))
                    )
                ) as distance_meters
            FROM users u
            INNER JOIN latest_locations ll ON u.id = ll.user_id
            WHERE u.helper_skills IS NOT NULL
        """

        params = [latitude, longitude, latitude]

        # Add skill filter if provided
        if required_skills:
            query += " AND u.helper_skills && %s"
            params.append(required_skills)

        query += """
            HAVING distance_meters <= %s
            ORDER BY distance_meters ASC
        """
        params.append(radius_meters)

        cursor.execute(query, params)
        rows = cursor.fetchall()

        helpers = []
        for row in rows:
            # Parse location
            location_str = row['location']
            if location_str:
                coords = location_str.strip('()').split(',')
                helper_lat = float(coords[0])
                helper_lon = float(coords[1])
            else:
                helper_lat = None
                helper_lon = None

            helpers.append({
                "user_id": row['id'],
                "name": row['name'],
                "contact_info": row['contact_info'],
                "skills": row['helper_skills'],
                "max_range": row['helper_max_range'],
                "location": {
                    "latitude": helper_lat,
                    "longitude": helper_lon
                },
                "last_updated": row['timestamp'].isoformat() if row['timestamp'] else None,
                "distance_km": round(row['distance_meters'] / 1000, 2)
            })

        return helpers


def create_assignment(
    case_id: int,
    helper_user_id: int,
    notes: Optional[str] = None
) -> Dict:
    """
    Create assignment (helper claims case).

    Validates:
    - Case is still open
    - Helper not already assigned to this case

    Args:
        case_id: Case to assign to
        helper_user_id: Helper claiming the case
        notes: Optional notes from helper

    Returns:
        Assignment dict
    """
    with get_db_cursor() as cursor:
        # Verify case is open
        cursor.execute(
            "SELECT id, status FROM cases WHERE id = %s",
            (case_id,)
        )
        case = cursor.fetchone()

        if not case:
            raise ValueError(f"Case {case_id} not found")

        if case['status'] not in ['open', 'assigned']:
            raise ValueError(f"Case {case_id} is not available (status: {case['status']})")

        # Check if helper already assigned
        cursor.execute(
            """
            SELECT id FROM assignments
            WHERE case_id = %s AND helper_user_id = %s AND completed_at IS NULL
            """,
            (case_id, helper_user_id)
        )
        existing = cursor.fetchone()

        if existing:
            raise ValueError(f"Helper {helper_user_id} already assigned to case {case_id}")

        # Create assignment
        cursor.execute(
            """
            INSERT INTO assignments (case_id, helper_user_id, notes)
            VALUES (%s, %s, %s)
            RETURNING id, case_id, helper_user_id, assigned_at, completed_at, notes, outcome
            """,
            (case_id, helper_user_id, notes)
        )
        assignment = cursor.fetchone()

        # Update case status to 'assigned' if it was 'open'
        if case['status'] == 'open':
            cursor.execute(
                "UPDATE cases SET status = 'assigned' WHERE id = %s",
                (case_id,)
            )

        # Log update
        cursor.execute(
            """
            INSERT INTO updates (
                case_id,
                assignment_id,
                update_source,
                update_type,
                description
            )
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                case_id,
                assignment['id'],
                'helper',
                'assignment_created',
                f'Helper {helper_user_id} assigned to case'
            )
        )

        # Trigger HelperGuideAgent asynchronously
        import threading
        def trigger_helper_guide():
            try:
                from services.research import run_helper_pipeline
                run_helper_pipeline(assignment['id'])
            except Exception as e:
                print(f"Error generating helper guide for assignment {assignment['id']}: {e}")

        thread = threading.Thread(target=trigger_helper_guide, daemon=True)
        thread.start()

        return {
            "assignment_id": assignment['id'],
            "case_id": assignment['case_id'],
            "helper_user_id": assignment['helper_user_id'],
            "assigned_at": assignment['assigned_at'].isoformat() if assignment['assigned_at'] else None,
            "completed_at": assignment['completed_at'].isoformat() if assignment['completed_at'] else None,
            "notes": assignment['notes'],
            "outcome": assignment['outcome'],
            "guide_generation_started": True
        }


def get_assignment(assignment_id: int) -> Optional[Dict]:
    """
    Get assignment by ID.

    Args:
        assignment_id: Assignment ID

    Returns:
        Assignment dict or None
    """
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(
            """
            SELECT
                id, case_id, helper_user_id, assigned_at, completed_at, notes, outcome
            FROM assignments
            WHERE id = %s
            """,
            (assignment_id,)
        )
        row = cursor.fetchone()

        if not row:
            return None

        return {
            "assignment_id": row['id'],
            "case_id": row['case_id'],
            "helper_user_id": row['helper_user_id'],
            "assigned_at": row['assigned_at'].isoformat() if row['assigned_at'] else None,
            "completed_at": row['completed_at'].isoformat() if row['completed_at'] else None,
            "notes": row['notes'],
            "outcome": row['outcome']
        }


def get_assignments_for_case(case_id: int) -> List[Dict]:
    """
    Get all assignments for a case.

    Args:
        case_id: Case ID

    Returns:
        List of assignments
    """
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(
            """
            SELECT
                id, case_id, helper_user_id, assigned_at, completed_at, notes, outcome
            FROM assignments
            WHERE case_id = %s
            ORDER BY assigned_at DESC
            """,
            (case_id,)
        )
        rows = cursor.fetchall()

        assignments = []
        for row in rows:
            assignments.append({
                "assignment_id": row['id'],
                "case_id": row['case_id'],
                "helper_user_id": row['helper_user_id'],
                "assigned_at": row['assigned_at'].isoformat() if row['assigned_at'] else None,
                "completed_at": row['completed_at'].isoformat() if row['completed_at'] else None,
                "notes": row['notes'],
                "outcome": row['outcome']
            })

        return assignments


def get_assignments_for_helper(helper_user_id: int, include_completed: bool = False) -> List[Dict]:
    """
    Get all assignments for a helper.

    Args:
        helper_user_id: Helper user ID
        include_completed: Include completed assignments

    Returns:
        List of assignments with case details
    """
    with get_db_cursor(commit=False) as cursor:
        query = """
            SELECT
                a.id, a.case_id, a.helper_user_id, a.assigned_at, a.completed_at, a.notes, a.outcome,
                c.location, c.description, c.urgency, c.danger_level, c.status
            FROM assignments a
            INNER JOIN cases c ON a.case_id = c.id
            WHERE a.helper_user_id = %s
        """

        if not include_completed:
            query += " AND a.completed_at IS NULL"

        query += " ORDER BY a.assigned_at DESC"

        cursor.execute(query, (helper_user_id,))
        rows = cursor.fetchall()

        assignments = []
        for row in rows:
            # Parse case location
            location_str = row['location']
            if location_str:
                coords = location_str.strip('()').split(',')
                case_lat = float(coords[0])
                case_lon = float(coords[1])
            else:
                case_lat = None
                case_lon = None

            assignments.append({
                "assignment_id": row['id'],
                "case_id": row['case_id'],
                "helper_user_id": row['helper_user_id'],
                "assigned_at": row['assigned_at'].isoformat() if row['assigned_at'] else None,
                "completed_at": row['completed_at'].isoformat() if row['completed_at'] else None,
                "notes": row['notes'],
                "outcome": row['outcome'],
                "case": {
                    "location": {
                        "latitude": case_lat,
                        "longitude": case_lon
                    },
                    "description": row['description'],
                    "urgency": row['urgency'],
                    "danger_level": row['danger_level'],
                    "status": row['status']
                }
            })

        return assignments


def complete_assignment(
    assignment_id: int,
    outcome: str,
    notes: Optional[str] = None
) -> Dict:
    """
    Mark assignment as completed.

    Args:
        assignment_id: Assignment ID
        outcome: Outcome description (e.g., "successfully_helped", "victim_not_found")
        notes: Optional completion notes

    Returns:
        Updated assignment dict
    """
    with get_db_cursor() as cursor:
        # Update assignment
        cursor.execute(
            """
            UPDATE assignments
            SET completed_at = NOW(), outcome = %s, notes = COALESCE(%s, notes)
            WHERE id = %s
            RETURNING id, case_id, helper_user_id, assigned_at, completed_at, notes, outcome
            """,
            (outcome, notes, assignment_id)
        )
        assignment = cursor.fetchone()

        if not assignment:
            raise ValueError(f"Assignment {assignment_id} not found")

        case_id = assignment['case_id']

        # Check if all assignments for this case are completed
        cursor.execute(
            """
            SELECT COUNT(*) as total, COUNT(completed_at) as completed
            FROM assignments
            WHERE case_id = %s
            """,
            (case_id,)
        )
        counts = cursor.fetchone()

        # If all assignments completed, mark case as resolved
        if counts['total'] == counts['completed']:
            cursor.execute(
                "UPDATE cases SET status = 'resolved', resolved_at = NOW() WHERE id = %s",
                (case_id,)
            )

        # Log update
        cursor.execute(
            """
            INSERT INTO updates (
                case_id,
                assignment_id,
                update_source,
                update_type,
                description
            )
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                case_id,
                assignment_id,
                'helper',
                'assignment_completed',
                f'Assignment completed: {outcome}'
            )
        )

        return {
            "assignment_id": assignment['id'],
            "case_id": assignment['case_id'],
            "helper_user_id": assignment['helper_user_id'],
            "assigned_at": assignment['assigned_at'].isoformat() if assignment['assigned_at'] else None,
            "completed_at": assignment['completed_at'].isoformat() if assignment['completed_at'] else None,
            "notes": assignment['notes'],
            "outcome": assignment['outcome']
        }
