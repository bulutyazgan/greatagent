"""
Agent Messages Service

Handles bidirectional communication between helper and victim agents
during an active assignment.

Key Functions:
- create_message: Send a message from helper or victim agent
- get_messages: Get all messages for an assignment (conversation history)
- get_unread_messages: Poll for new messages (for real-time updates)
- mark_as_read: Mark messages as read by recipient
"""

import sys
import os
from typing import Dict, List, Optional
import json

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database.db import get_db_cursor


def create_message(
    assignment_id: int,
    case_id: int,
    sender: str,
    message_type: str,
    message_text: str,
    options: Optional[List[Dict]] = None,
    question_type: Optional[str] = None,
    in_response_to: Optional[int] = None
) -> Dict:
    """
    Create a new agent message.

    Args:
        assignment_id: Assignment ID
        case_id: Case ID
        sender: 'helper_agent', 'victim_agent', 'helper_user', or 'victim_user'
        message_type: 'question', 'answer', 'status_update', or 'guidance'
        message_text: Message content
        options: Optional list of button options for interactive questions
        question_type: 'single' or 'multiple' for option questions
        in_response_to: Optional message ID this is responding to

    Returns:
        Created message dict
    """
    # Validate sender
    valid_senders = ['helper_agent', 'victim_agent', 'helper_user', 'victim_user']
    if sender not in valid_senders:
        raise ValueError(f"Invalid sender: {sender}. Must be one of {valid_senders}")

    # Validate message_type
    valid_types = ['question', 'answer', 'status_update', 'guidance']
    if message_type not in valid_types:
        raise ValueError(f"Invalid message_type: {message_type}. Must be one of {valid_types}")

    with get_db_cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO agent_messages (
                assignment_id, case_id, sender, message_type, message_text,
                options, question_type, in_response_to
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, assignment_id, case_id, sender, message_type, message_text,
                      options, question_type, in_response_to, read_by_recipient,
                      read_at, created_at
            """,
            (
                assignment_id, case_id, sender, message_type, message_text,
                json.dumps(options) if options else None,
                question_type, in_response_to
            )
        )
        row = cursor.fetchone()

        return {
            "message_id": row['id'],
            "assignment_id": row['assignment_id'],
            "case_id": row['case_id'],
            "sender": row['sender'],
            "message_type": row['message_type'],
            "message_text": row['message_text'],
            "options": row['options'],
            "question_type": row['question_type'],
            "in_response_to": row['in_response_to'],
            "read_by_recipient": row['read_by_recipient'],
            "read_at": row['read_at'].isoformat() if row['read_at'] else None,
            "created_at": row['created_at'].isoformat() if row['created_at'] else None
        }


def get_messages(
    assignment_id: int,
    sender_filter: Optional[str] = None,
    limit: int = 100
) -> List[Dict]:
    """
    Get all messages for an assignment (conversation history).

    Args:
        assignment_id: Assignment ID
        sender_filter: Optional filter by sender type
        limit: Maximum number of messages to return

    Returns:
        List of message dicts, ordered by created_at ASC (chronological)
    """
    with get_db_cursor(commit=False) as cursor:
        if sender_filter:
            cursor.execute(
                """
                SELECT
                    id, assignment_id, case_id, sender, message_type, message_text,
                    options, question_type, in_response_to, read_by_recipient,
                    read_at, created_at
                FROM agent_messages
                WHERE assignment_id = %s AND sender = %s
                ORDER BY created_at ASC
                LIMIT %s
                """,
                (assignment_id, sender_filter, limit)
            )
        else:
            cursor.execute(
                """
                SELECT
                    id, assignment_id, case_id, sender, message_type, message_text,
                    options, question_type, in_response_to, read_by_recipient,
                    read_at, created_at
                FROM agent_messages
                WHERE assignment_id = %s
                ORDER BY created_at ASC
                LIMIT %s
                """,
                (assignment_id, limit)
            )

        rows = cursor.fetchall()

        return [
            {
                "message_id": row['id'],
                "assignment_id": row['assignment_id'],
                "case_id": row['case_id'],
                "sender": row['sender'],
                "message_type": row['message_type'],
                "message_text": row['message_text'],
                "options": row['options'],
                "question_type": row['question_type'],
                "in_response_to": row['in_response_to'],
                "read_by_recipient": row['read_by_recipient'],
                "read_at": row['read_at'].isoformat() if row['read_at'] else None,
                "created_at": row['created_at'].isoformat() if row['created_at'] else None
            }
            for row in rows
        ]


def get_unread_messages(
    assignment_id: int,
    for_sender: str
) -> List[Dict]:
    """
    Get unread messages for a specific recipient.

    Args:
        assignment_id: Assignment ID
        for_sender: Who is checking for messages ('helper_agent' or 'victim_agent')
                   Will return messages sent by the OTHER party

    Returns:
        List of unread message dicts
    """
    # Determine which sender types this recipient should see
    if for_sender in ['helper_agent', 'helper_user']:
        # Helper sees messages from victim
        sender_filter = "sender IN ('victim_agent', 'victim_user')"
    elif for_sender in ['victim_agent', 'victim_user']:
        # Victim sees messages from helper
        sender_filter = "sender IN ('helper_agent', 'helper_user')"
    else:
        raise ValueError(f"Invalid for_sender: {for_sender}")

    with get_db_cursor(commit=False) as cursor:
        cursor.execute(
            f"""
            SELECT
                id, assignment_id, case_id, sender, message_type, message_text,
                options, question_type, in_response_to, read_by_recipient,
                read_at, created_at
            FROM agent_messages
            WHERE assignment_id = %s
              AND {sender_filter}
              AND read_by_recipient = FALSE
            ORDER BY created_at ASC
            """,
            (assignment_id,)
        )

        rows = cursor.fetchall()

        return [
            {
                "message_id": row['id'],
                "assignment_id": row['assignment_id'],
                "case_id": row['case_id'],
                "sender": row['sender'],
                "message_type": row['message_type'],
                "message_text": row['message_text'],
                "options": row['options'],
                "question_type": row['question_type'],
                "in_response_to": row['in_response_to'],
                "read_by_recipient": row['read_by_recipient'],
                "read_at": row['read_at'].isoformat() if row['read_at'] else None,
                "created_at": row['created_at'].isoformat() if row['created_at'] else None
            }
            for row in rows
        ]


def mark_as_read(message_ids: List[int]) -> int:
    """
    Mark messages as read.

    Args:
        message_ids: List of message IDs to mark as read

    Returns:
        Number of messages marked as read
    """
    if not message_ids:
        return 0

    with get_db_cursor() as cursor:
        cursor.execute(
            """
            UPDATE agent_messages
            SET read_by_recipient = TRUE, read_at = NOW()
            WHERE id = ANY(%s)
            RETURNING id
            """,
            (message_ids,)
        )
        return len(cursor.fetchall())


def get_latest_question(assignment_id: int, for_sender: str) -> Optional[Dict]:
    """
    Get the latest unanswered question from the other party.

    Args:
        assignment_id: Assignment ID
        for_sender: Who is checking ('helper_agent' or 'victim_agent')

    Returns:
        Latest question dict or None
    """
    # Determine which sender types this recipient should see
    if for_sender in ['helper_agent', 'helper_user']:
        sender_filter = "sender IN ('victim_agent', 'victim_user')"
    elif for_sender in ['victim_agent', 'victim_user']:
        sender_filter = "sender IN ('helper_agent', 'helper_user')"
    else:
        raise ValueError(f"Invalid for_sender: {for_sender}")

    with get_db_cursor(commit=False) as cursor:
        cursor.execute(
            f"""
            SELECT
                id, assignment_id, case_id, sender, message_type, message_text,
                options, question_type, in_response_to, read_by_recipient,
                read_at, created_at
            FROM agent_messages
            WHERE assignment_id = %s
              AND {sender_filter}
              AND message_type = 'question'
              AND id NOT IN (
                  -- Exclude questions that have been answered
                  SELECT DISTINCT in_response_to
                  FROM agent_messages
                  WHERE assignment_id = %s AND in_response_to IS NOT NULL
              )
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (assignment_id, assignment_id)
        )

        row = cursor.fetchone()
        if not row:
            return None

        return {
            "message_id": row['id'],
            "assignment_id": row['assignment_id'],
            "case_id": row['case_id'],
            "sender": row['sender'],
            "message_type": row['message_type'],
            "message_text": row['message_text'],
            "options": row['options'],
            "question_type": row['question_type'],
            "in_response_to": row['in_response_to'],
            "read_by_recipient": row['read_by_recipient'],
            "read_at": row['read_at'].isoformat() if row['read_at'] else None,
            "created_at": row['created_at'].isoformat() if row['created_at'] else None
        }
