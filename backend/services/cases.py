"""
Case Management Service

Handles:
- Case creation (bootstrap with raw text)
- Case lifecycle management
- Triggering InputProcessingAgent asynchronously
- Case queries and updates
"""

import sys
import os
from typing import Dict, Optional, List
from datetime import datetime
import threading

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database.db import get_db_cursor


def create_case(
    user_id: Optional[str],
    latitude: float,
    longitude: float,
    raw_problem_description: str,
    emergency_id: Optional[int] = None
) -> Dict:
    """
    Create a new case with minimal information.

    This is the bootstrap endpoint - creates case row immediately,
    then triggers InputProcessingAgent asynchronously to populate
    structured fields.

    Args:
        user_id: UUID of caller (can be None for anonymous)
        latitude: Incident latitude
        longitude: Incident longitude
        raw_problem_description: Exactly what the user typed
        emergency_id: Optional emergency ID to associate with

    Returns:
        Dict with case_id, status, and basic info
    """

    # Format location as PostgreSQL POINT
    location_point = f"({latitude},{longitude})"

    # Convert user_id to integer if provided
    caller_user_id = int(user_id) if user_id and user_id.isdigit() else None

    with get_db_cursor() as cursor:
        # Insert minimal case row
        cursor.execute(
            """
            INSERT INTO cases (
                caller_user_id,
                reported_by_user_id,
                location,
                raw_problem_description,
                description,
                urgency,
                danger_level,
                status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, caller_user_id, location, raw_problem_description, status, created_at
            """,
            (
                caller_user_id,
                caller_user_id,  # Self-reported
                location_point,
                raw_problem_description,
                None,  # Will be filled by agent
                'high',  # Safe default
                'severe',  # Safe default
                'open'
            )
        )
        case_row = cursor.fetchone()
        case_id = case_row['id']

        # Log to updates table
        cursor.execute(
            """
            INSERT INTO updates (
                case_id,
                update_source,
                update_type,
                update_text
            )
            VALUES (%s, %s, %s, %s)
            """,
            (
                case_id,
                'system',
                'case_created',
                f'New case created from location ({latitude}, {longitude})'
            )
        )

        # Trigger InputProcessingAgent asynchronously
        # Use threading for now (will replace with Celery/RQ later)
        def process_case_async():
            try:
                import asyncio
                from services.research import run_input_processing_agent
                asyncio.run(run_input_processing_agent(case_id))
            except Exception as e:
                print(f"Error in async processing for case {case_id}: {e}")
                # Log error to updates table
                with get_db_cursor() as error_cursor:
                    error_cursor.execute(
                        """
                        INSERT INTO updates (case_id, update_source, update_type, update_text)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (case_id, 'ai_agent', 'processing_error', str(e))
                    )

        # Start background thread
        thread = threading.Thread(target=process_case_async, daemon=True)
        thread.start()

        return {
            "case_id": case_id,
            "caller_user_id": caller_user_id,
            "location": {
                "latitude": latitude,
                "longitude": longitude
            },
            "raw_problem_description": raw_problem_description,
            "status": case_row['status'],
            "created_at": case_row['created_at'].isoformat() if case_row['created_at'] else None,
            "processing_started": True
        }


def get_case(case_id: int) -> Optional[Dict]:
    """
    Get case by ID with full details.

    Args:
        case_id: Case ID

    Returns:
        Dict with case data or None if not found
    """
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(
            """
            SELECT
                id, caller_user_id, reported_by_user_id, case_group_id,
                location, description, raw_problem_description,
                people_count, mobility_status, vulnerability_factors,
                urgency, danger_level, ai_reasoning, status, created_at, resolved_at
            FROM cases
            WHERE id = %s
            """,
            (case_id,)
        )
        row = cursor.fetchone()

        if not row:
            return None

        # Parse location
        location_str = row['location']
        if location_str:
            coords = location_str.strip('()').split(',')
            # POINT stored as (latitude, longitude) to match codebase convention
            latitude = float(coords[0])
            longitude = float(coords[1])
        else:
            latitude = None
            longitude = None

        return {
            "case_id": row['id'],
            "caller_user_id": row['caller_user_id'],
            "reported_by_user_id": row['reported_by_user_id'],
            "case_group_id": row['case_group_id'],
            "location": {
                "latitude": latitude,
                "longitude": longitude
            },
            "description": row['description'],
            "raw_problem_description": row['raw_problem_description'],
            "people_count": row['people_count'],
            "mobility_status": row['mobility_status'],
            "vulnerability_factors": row['vulnerability_factors'],
            "urgency": row['urgency'],
            "danger_level": row['danger_level'],
            "ai_reasoning": row['ai_reasoning'],
            "status": row['status'],
            "created_at": row['created_at'].isoformat() if row['created_at'] else None,
            "resolved_at": row['resolved_at'].isoformat() if row['resolved_at'] else None
        }


def get_nearby_cases(
    latitude: float,
    longitude: float,
    radius_km: float = 10.0,
    status_filter: Optional[List[str]] = None
) -> List[Dict]:
    """
    Get cases near a location (for helper map view).

    Uses Haversine formula for distance calculation.

    Args:
        latitude: Helper's latitude
        longitude: Helper's longitude
        radius_km: Search radius in kilometers
        status_filter: List of statuses to include (default: ['open'])

    Returns:
        List of cases with distance
    """
    if status_filter is None:
        status_filter = ['open']

    radius_meters = radius_km * 1000

    with get_db_cursor(commit=False) as cursor:
        # Get all cases first, then filter by distance in Python
        # (simpler than PostGIS when extension not available)
        cursor.execute(
            """
            SELECT
                id, caller_user_id, case_group_id, location,
                description, raw_problem_description, people_count,
                mobility_status, vulnerability_factors,
                urgency, danger_level, ai_reasoning, status, created_at,
                reported_by_user_id
            FROM cases
            WHERE status = ANY(%s)
            ORDER BY created_at DESC
            """,
            (status_filter,)
        )
        rows = cursor.fetchall()

        import math

        def haversine_distance(lat1, lon1, lat2, lon2):
            """Calculate distance between two points in meters using Haversine formula"""
            R = 6371000  # Earth radius in meters
            phi1 = math.radians(lat1)
            phi2 = math.radians(lat2)
            delta_phi = math.radians(lat2 - lat1)
            delta_lambda = math.radians(lon2 - lon1)

            a = math.sin(delta_phi/2)**2 + \
                math.cos(phi1) * math.cos(phi2) * \
                math.sin(delta_lambda/2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

            return R * c

        cases = []
        for row in rows:
            # Parse location
            location_str = row['location']
            if location_str:
                coords = location_str.strip('()').split(',')
                # POINT stored as (latitude, longitude) to match codebase convention
                case_lat = float(coords[0])
                case_lon = float(coords[1])

                # Calculate distance
                distance_meters = haversine_distance(latitude, longitude, case_lat, case_lon)

                # Skip if outside radius
                if distance_meters > radius_meters:
                    continue
            else:
                case_lat = None
                case_lon = None
                distance_meters = 0

            cases.append({
                "case_id": row['id'],
                "caller_user_id": row['caller_user_id'],
                "reported_by_user_id": row['reported_by_user_id'],
                "case_group_id": row['case_group_id'],
                "location": {
                    "latitude": case_lat,
                    "longitude": case_lon
                },
                "description": row['description'],
                "raw_problem_description": row['raw_problem_description'],
                "people_count": row['people_count'],
                "mobility_status": row['mobility_status'],
                "vulnerability_factors": row['vulnerability_factors'],
                "urgency": row['urgency'],
                "danger_level": row['danger_level'],
                "ai_reasoning": row['ai_reasoning'],
                "status": row['status'],
                "created_at": row['created_at'].isoformat() if row['created_at'] else None,
                "distance_km": round(distance_meters / 1000, 2)
            })

        return cases


def update_case_status(
    case_id: int,
    status: str,
    resolved_by_user_id: Optional[int] = None
) -> Dict:
    """
    Update case status.

    Args:
        case_id: Case ID
        status: New status (open, assigned, in_progress, resolved, closed)
        resolved_by_user_id: User who resolved (if status=resolved)

    Returns:
        Updated case dict
    """
    with get_db_cursor() as cursor:
        update_fields = ["status = %s"]
        params = [status]

        if status == 'resolved' and resolved_by_user_id:
            update_fields.append("resolved_at = NOW()")

        params.append(case_id)

        cursor.execute(
            f"""
            UPDATE cases
            SET {', '.join(update_fields)}
            WHERE id = %s
            RETURNING id, status, resolved_at
            """,
            params
        )
        row = cursor.fetchone()

        # Log update
        cursor.execute(
            """
            INSERT INTO updates (case_id, update_source, update_type, update_text)
            VALUES (%s, %s, %s, %s)
            """,
            (case_id, 'system', 'status_change', f'Status changed to {status}')
        )

        return {
            "case_id": row['id'],
            "status": row['status'],
            "resolved_at": row['resolved_at'].isoformat() if row['resolved_at'] else None
        }

async def async_get_nearby_cases(
    latitude: float,
    longitude: float,
    radius_km: float = 10.0,
    status_filter: Optional[List[str]] = None
) -> List[Dict]:
    """
    Asynchronously get cases near a location.
    """
    import asyncio
    return await asyncio.to_thread(get_nearby_cases, latitude, longitude, radius_km, status_filter)
