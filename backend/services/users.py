"""
User and Location Management Service

Handles:
- User creation/updates (with UUID for anonymous users)
- Location consent and tracking
- Location history management
"""

import sys
import os
from typing import Dict, Optional, Tuple
from datetime import datetime
import uuid

# Add parent directory to path for database imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database.db import get_db_cursor


def create_or_update_user_location(
    user_id: Optional[str],
    latitude: float,
    longitude: float,
    name: Optional[str] = None,
    contact_info: Optional[str] = None,
    is_helper: bool = False,
    helper_skills: Optional[list] = None,
    helper_max_range: Optional[int] = None
) -> Dict:
    """
    Create or update user with location consent.

    This is the entry point for both caller and helper flows.
    - If user_id is None, generates a UUID for client-side storage
    - Updates user location and logs to location_tracking
    - Idempotent: same user_id + timestamp won't duplicate

    Args:
        user_id: UUID string or None (will generate new UUID)
        latitude: Current latitude
        longitude: Current longitude
        name: User's name (default "Anonymous User")
        contact_info: Phone/email for emergency contact
        is_helper: True if user is a helper, False if caller
        helper_skills: List of skills (e.g., ['medical', 'first_aid'])
        helper_max_range: Max distance in meters helper willing to travel

    Returns:
        Dict with user_id, location, created/updated status
    """

    # Generate UUID if not provided
    if user_id is None:
        user_id = str(uuid.uuid4())
        is_new_user = True
    else:
        is_new_user = False

    # Default name for anonymous users
    if name is None:
        name = f"Anonymous User {user_id[:8]}"

    # Format location as PostgreSQL POINT
    location_point = f"({latitude},{longitude})"

    with get_db_cursor() as cursor:
        # Check if user exists
        cursor.execute(
            "SELECT id FROM users WHERE id::text = %s",
            (user_id,)
        )
        existing_user = cursor.fetchone()

        if existing_user:
            # Update existing user
            update_fields = ["location = %s"]
            params = [location_point]

            if name:
                update_fields.append("name = %s")
                params.append(name)

            if contact_info:
                update_fields.append("contact_info = %s")
                params.append(contact_info)

            if is_helper:
                update_fields.append("helper_skills = %s")
                params.append(helper_skills or [])
                update_fields.append("helper_max_range = %s")
                params.append(helper_max_range)

            params.append(user_id)

            cursor.execute(
                f"""
                UPDATE users
                SET {', '.join(update_fields)}
                WHERE id::text = %s
                RETURNING id, name, location, contact_info, helper_skills, helper_max_range, created_at
                """,
                params
            )
            user_row = cursor.fetchone()
            action = "updated"
        else:
            # Insert new user
            cursor.execute(
                """
                INSERT INTO users (name, location, contact_info, helper_skills, helper_max_range)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, name, location, contact_info, helper_skills, helper_max_range, created_at
                """,
                (name, location_point, contact_info, helper_skills, helper_max_range)
            )
            user_row = cursor.fetchone()
            user_id = str(user_row['id'])
            action = "created"

        # Insert into location_tracking (idempotent by timestamp)
        cursor.execute(
            """
            INSERT INTO location_tracking (user_id, location, timestamp)
            VALUES (%s, %s, NOW())
            ON CONFLICT DO NOTHING
            """,
            (user_row['id'], location_point)
        )

        return {
            "user_id": user_id,
            "name": user_row['name'],
            "location": {
                "latitude": latitude,
                "longitude": longitude
            },
            "contact_info": user_row['contact_info'],
            "is_helper": bool(user_row['helper_skills']),
            "helper_skills": user_row['helper_skills'],
            "helper_max_range": user_row['helper_max_range'],
            "created_at": user_row['created_at'].isoformat() if user_row['created_at'] else None,
            "action": action
        }


def get_user(user_id: str) -> Optional[Dict]:
    """
    Get user by ID.

    Args:
        user_id: UUID string

    Returns:
        Dict with user data or None if not found
    """
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(
            """
            SELECT id, name, location, contact_info, helper_skills, helper_max_range, created_at
            FROM users
            WHERE id::text = %s
            """,
            (user_id,)
        )
        row = cursor.fetchone()

        if not row:
            return None

        # Parse POINT format (lat,lon)
        location_str = row['location']
        if location_str:
            # Remove parentheses and split
            coords = location_str.strip('()').split(',')
            latitude = float(coords[0])
            longitude = float(coords[1])
        else:
            latitude = None
            longitude = None

        return {
            "user_id": str(row['id']),
            "name": row['name'],
            "location": {
                "latitude": latitude,
                "longitude": longitude
            },
            "contact_info": row['contact_info'],
            "is_helper": bool(row['helper_skills']),
            "helper_skills": row['helper_skills'],
            "helper_max_range": row['helper_max_range'],
            "created_at": row['created_at'].isoformat() if row['created_at'] else None
        }


def get_user_location_history(user_id: str, limit: int = 100) -> list:
    """
    Get location tracking history for a user.

    Args:
        user_id: UUID string
        limit: Max number of records to return

    Returns:
        List of location records with timestamps
    """
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(
            """
            SELECT location, timestamp
            FROM location_tracking
            WHERE user_id::text = %s
            ORDER BY timestamp DESC
            LIMIT %s
            """,
            (user_id, limit)
        )
        rows = cursor.fetchall()

        locations = []
        for row in rows:
            # Parse POINT format
            location_str = row['location']
            if location_str:
                coords = location_str.strip('()').split(',')
                locations.append({
                    "latitude": float(coords[0]),
                    "longitude": float(coords[1]),
                    "timestamp": row['timestamp'].isoformat() if row['timestamp'] else None
                })

        return locations
