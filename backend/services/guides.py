"""
Guide Management Service

Handles:
- Fetching caller guides (AI-generated emergency response guidance)
- Fetching helper guides (AI-generated responder guidance)
- Guide storage and retrieval
"""

import sys
import os
from typing import Dict, Optional

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database.db import get_db_cursor


def get_caller_guide(case_id: int) -> Optional[Dict]:
    """
    Get caller guide for a case.

    Returns the latest AI-generated guidance for victims.

    Args:
        case_id: Case ID

    Returns:
        Guide dict with guide_text, research info, or None if not generated yet
    """
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(
            """
            SELECT
                id, case_id, guide_text, research_query,
                research_results_summary, created_at
            FROM caller_guides
            WHERE case_id = %s
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (case_id,)
        )
        row = cursor.fetchone()

        if not row:
            return None

        return {
            "guide_id": row['id'],
            "case_id": row['case_id'],
            "guide_text": row['guide_text'],
            "research_query": row['research_query'],
            "research_results_summary": row['research_results_summary'],
            "created_at": row['created_at'].isoformat() if row['created_at'] else None
        }


def get_helper_guide(assignment_id: int) -> Optional[Dict]:
    """
    Get helper guide for an assignment.

    Returns the latest AI-generated guidance for responders.

    Args:
        assignment_id: Assignment ID

    Returns:
        Guide dict with guide_text, research info, or None if not generated yet
    """
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(
            """
            SELECT
                id, assignment_id, guide_text, research_query,
                research_results_summary, created_at
            FROM helper_guides
            WHERE assignment_id = %s
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (assignment_id,)
        )
        row = cursor.fetchone()

        if not row:
            return None

        return {
            "guide_id": row['id'],
            "assignment_id": row['assignment_id'],
            "guide_text": row['guide_text'],
            "research_query": row['research_query'],
            "research_results_summary": row['research_results_summary'],
            "created_at": row['created_at'].isoformat() if row['created_at'] else None
        }


def save_caller_guide(
    case_id: int,
    guide_text: str,
    research_query: Optional[str] = None,
    research_results_summary: Optional[str] = None
) -> Dict:
    """
    Save caller guide (replaces existing).

    Args:
        case_id: Case ID
        guide_text: Markdown-formatted guidance (3 bullet points)
        research_query: Query used for Valyu search
        research_results_summary: Summary of research results

    Returns:
        Saved guide dict
    """
    with get_db_cursor() as cursor:
        # Insert or replace (UNIQUE constraint on case_id)
        cursor.execute(
            """
            INSERT INTO caller_guides (case_id, guide_text, research_query, research_results_summary)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (case_id)
            DO UPDATE SET
                guide_text = EXCLUDED.guide_text,
                research_query = EXCLUDED.research_query,
                research_results_summary = EXCLUDED.research_results_summary,
                created_at = NOW()
            RETURNING id, case_id, guide_text, research_query, research_results_summary, created_at
            """,
            (case_id, guide_text, research_query, research_results_summary)
        )
        row = cursor.fetchone()

        # Log update
        cursor.execute(
            """
            INSERT INTO updates (
                case_id,
                update_source,
                update_type,
                description
            )
            VALUES (%s, %s, %s, %s)
            """,
            (case_id, 'ai_agent', 'guide_generated', 'Caller guide generated')
        )

        return {
            "guide_id": row['id'],
            "case_id": row['case_id'],
            "guide_text": row['guide_text'],
            "research_query": row['research_query'],
            "research_results_summary": row['research_results_summary'],
            "created_at": row['created_at'].isoformat() if row['created_at'] else None
        }


def save_helper_guide(
    assignment_id: int,
    guide_text: str,
    research_query: Optional[str] = None,
    research_results_summary: Optional[str] = None
) -> Dict:
    """
    Save helper guide (replaces existing).

    Args:
        assignment_id: Assignment ID
        guide_text: Markdown-formatted guidance (3 bullet points)
        research_query: Query used for Valyu search
        research_results_summary: Summary of research results

    Returns:
        Saved guide dict
    """
    with get_db_cursor() as cursor:
        # Get case_id for logging
        cursor.execute(
            "SELECT case_id FROM assignments WHERE id = %s",
            (assignment_id,)
        )
        assignment = cursor.fetchone()

        if not assignment:
            raise ValueError(f"Assignment {assignment_id} not found")

        case_id = assignment['case_id']

        # Insert or replace (UNIQUE constraint on assignment_id)
        cursor.execute(
            """
            INSERT INTO helper_guides (assignment_id, guide_text, research_query, research_results_summary)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (assignment_id)
            DO UPDATE SET
                guide_text = EXCLUDED.guide_text,
                research_query = EXCLUDED.research_query,
                research_results_summary = EXCLUDED.research_results_summary,
                created_at = NOW()
            RETURNING id, assignment_id, guide_text, research_query, research_results_summary, created_at
            """,
            (assignment_id, guide_text, research_query, research_results_summary)
        )
        row = cursor.fetchone()

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
            (case_id, assignment_id, 'ai_agent', 'guide_generated', 'Helper guide generated')
        )

        return {
            "guide_id": row['id'],
            "assignment_id": row['assignment_id'],
            "guide_text": row['guide_text'],
            "research_query": row['research_query'],
            "research_results_summary": row['research_results_summary'],
            "created_at": row['created_at'].isoformat() if row['created_at'] else None
        }
