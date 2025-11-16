"""
Research and Agent Pipeline Orchestration Service

Handles:
- InputProcessingAgent: Parse raw help request into structured data
- ResearchAgent: Call Valyu search for context
- CallerGuideAgent: Generate guidance for victims
- HelperGuideAgent: Generate guidance for responders

All pipelines use LangGraph and integrate with Bedrock API.
"""

import sys
import os
import json
import asyncio
from typing import Dict, Optional, List

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database.db import get_db_cursor
from main import get_api_session, API_ENDPOINT, MODELS, TEAM_ID, API_TOKEN
from agent_tools import async_valyu_deepsearch
from services.cases import async_get_nearby_cases


# Initialize API client
api_client = get_api_session()


async def run_input_processing_agent(case_id: int) -> Dict:
    """
    Run InputProcessingAgent to parse raw help request.

    Extracts structured data from raw_problem_description:
    - people_count, mobility_status, vulnerability_factors
    - urgency, danger_level
    - cleaned update_text

    Updates the cases row with extracted data.

    Args:
        case_id: Case ID to process

    Returns:
        Dict with extracted data
    """
    with get_db_cursor() as cursor:
        # Fetch case
        cursor.execute(
            """
            SELECT id, raw_problem_description, location, caller_user_id
            FROM cases
            WHERE id = %s
            """,
            (case_id,)
        )
        case = cursor.fetchone()

        if not case:
            raise ValueError(f"Case {case_id} not found")

        raw_text = case['raw_problem_description']
        if not raw_text:
            raise ValueError(f"Case {case_id} has no raw_problem_description")

        # Parse location
        location_str = case['location']
        coords = location_str.strip('()').split(',')
        latitude = float(coords[0])
        longitude = float(coords[1])

        # System prompt for extraction
        system_prompt = (
            "You are an emergency intake agent. Your job is to read a user's free-text "
            "message describing an emergency and infer as much structured information as possible. "
            "Always return JSON strictly matching this schema:\n\n"
            "{\n"
            '  "description": str (cleaned, concise update_text),\n'
            '  "people_count": int | null,\n'
            '  "mobility_status": "mobile" | "injured" | "trapped" | null,\n'
            '  "vulnerability_factors": list of '
            '["elderly","children_present","medical_needs","disability","pregnant"],\n'
            '  "urgency": "low" | "medium" | "high" | "critical",\n'
            '  "danger_level": "safe" | "moderate" | "severe" | "life_threatening",\n'
            '  "reasoning": str (2-3 sentences explaining why you assigned this urgency/danger level)\n'
            "}\n\n"
            "IMPORTANT: The reasoning field should explain your assessment in plain language. "
            "Example: 'Marked as CRITICAL urgency due to trapped individual with breathing difficulty. "
            "Life-threatening danger level assigned because situation could deteriorate rapidly without immediate help.'\n\n"
            "Always make a best guess. If unsure, use null for optional fields, "
            'urgency = "high", and danger_level = "severe". '
            "Do not include any extra keys or text outside the JSON."
        )

        # Call Bedrock API
        body = {
            "team_id": TEAM_ID,
            "api_token": API_TOKEN,
            "model": MODELS["recommended"],  # Claude Sonnet
            "messages": [
                {
                    "role": "user",
                    "content": (
                        f"{system_prompt}\n\n"
                        f"User text: {raw_text}\n"
                        f"Location: ({latitude}, {longitude})"
                    )
                }
            ],
            "max_tokens": 512
        }

        response = await api_client.post(API_ENDPOINT, json=body)
        response.raise_for_status()
        result = response.json()

        # Extract JSON from response
        raw_content = result.get("content", [])[0].get("text", "{}")
        try:
            extracted_data = json.loads(raw_content)
        except Exception as e:
            # Fallback to safe defaults
            print(f"Error parsing agent output: {e}")
            extracted_data = {
                "description": raw_text[:200],
                "people_count": None,
                "mobility_status": None,
                "vulnerability_factors": [],
                "urgency": "high",
                "danger_level": "severe"
            }

        # Update cases table
        cursor.execute(
            """
            UPDATE cases
            SET
                description = %s,
                people_count = %s,
                mobility_status = %s,
                vulnerability_factors = %s,
                urgency = %s,
                danger_level = %s,
                ai_reasoning = %s
            WHERE id = %s
            """,
            (
                extracted_data.get("description"),
                extracted_data.get("people_count"),
                extracted_data.get("mobility_status"),
                extracted_data.get("vulnerability_factors", []),
                extracted_data.get("urgency", "high"),
                extracted_data.get("danger_level", "severe"),
                extracted_data.get("reasoning", "AI analysis in progress..."),
                case_id
            )
        )

        # Log update
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
                'ai_agent',
                'case_processed',
                f'Extracted: urgency={extracted_data.get("urgency")}, danger={extracted_data.get("danger_level")}'
            )
        )

    # Trigger caller guide generation
    await run_caller_pipeline(case_id)

    return extracted_data


async def run_caller_pipeline(case_id: int) -> Dict:
    """
    Run ResearchAgent + CallerGuideAgent pipeline.

    Steps:
    1. Fetch case data
    2. Build search query from structured data
    3. Call valyu_deepsearch
    4. Feed results to CallerGuideAgent
    5. Generate 3 bullet points of guidance
    6. Save to caller_guides table

    Args:
        case_id: Case ID

    Returns:
        Dict with guide_text and research summary
    """
    from services.guides import save_caller_guide

    with get_db_cursor(commit=False) as cursor:
        # Fetch case
        cursor.execute(
            """
            SELECT
                id, description, raw_problem_description, mobility_status,
                urgency, danger_level, people_count
            FROM cases
            WHERE id = %s
            """,
            (case_id,)
        )
        case = cursor.fetchone()

        if not case:
            raise ValueError(f"Case {case_id} not found")

        # Build research query
        description = case['description'] or case['raw_problem_description'] or "emergency situation"
        mobility = case['mobility_status'] or "unknown mobility"
        urgency = case['urgency'] or "high"

        research_query = f"immediate actions while {mobility} in {description} during emergency"

        # Call Valyu search
        try:
            search_results_raw = await async_valyu_deepsearch(
                query=research_query,
                search_type="all",
                max_num_results=5,
                response_length="short"
            )
            search_results = json.loads(search_results_raw)
            research_success = search_results.get("success", False)
        except Exception as e:
            print(f"Valyu search failed: {e}")
            research_success = False
            search_results = {"results_preview": []}

        # Extract relevant content
        if research_success and search_results.get("results_preview"):
            research_summary = "\n".join([
                f"- {r.get('title', 'N/A')}: {r.get('content_preview', 'N/A')[:100]}"
                for r in search_results.get("results_preview", [])[:3]
            ])
        else:
            research_summary = "No research results available. Using general emergency guidance."

        # CallerGuideAgent prompt
        guide_prompt = (
            f"Based on this emergency situation:\n"
            f"- Description: {description}\n"
            f"- Mobility: {mobility}\n"
            f"- Urgency: {urgency}\n"
            f"- Danger level: {case['danger_level']}\n"
            f"- People count: {case['people_count'] or 'unknown'}\n\n"
            f"Research results:\n{research_summary}\n\n"
            "Generate exactly 3 actionable bullet points for the victim to follow "
            "while waiting for help. Keep each point to 1-2 sentences. "
            "Focus on immediate safety actions. Format as markdown list."
        )

        # Call LLM for guide generation
        body = {
            "team_id": TEAM_ID,
            "api_token": API_TOKEN,
            "model": MODELS["fast"],  # Use Haiku for speed
            "messages": [
                {"role": "user", "content": guide_prompt}
            ],
            "max_tokens": 300
        }

        response = await api_client.post(API_ENDPOINT, json=body)
        response.raise_for_status()
        result = response.json()

        guide_text = result.get("content", [])[0].get("text", "No guidance available.")

        # Save guide
        guide = save_caller_guide(
            case_id=case_id,
            guide_text=guide_text,
            research_query=research_query,
            research_results_summary=research_summary[:500]  # Truncate
        )

        return guide


async def run_helper_pipeline(assignment_id: int) -> Dict:
    """
    Run ResearchAgent + HelperGuideAgent pipeline.

    Steps:
    1. Fetch assignment and case data
    2. Build search query tailored for responders
    3. Call valyu_deepsearch
    4. Feed results to HelperGuideAgent
    5. Generate 3 bullet points of responder guidance
    6. Save to helper_guides table

    Args:
        assignment_id: Assignment ID

    Returns:
        Dict with guide_text and research summary
    """
    from services.guides import save_helper_guide

    with get_db_cursor(commit=False) as cursor:
        # Fetch assignment and case
        cursor.execute(
            """
            SELECT
                a.id as assignment_id, a.case_id,
                c.description, c.raw_problem_description, c.mobility_status,
                c.urgency, c.danger_level, c.people_count, c.location
            FROM assignments a
            INNER JOIN cases c ON a.case_id = c.id
            WHERE a.id = %s
            """,
            (assignment_id,)
        )
        row = cursor.fetchone()

        if not row:
            raise ValueError(f"Assignment {assignment_id} not found")

        # Build research query for helpers
        description = row['description'] or row['raw_problem_description'] or "emergency situation"
        mobility = row['mobility_status'] or "unknown mobility"
        location_str = row['location']
        coords = location_str.strip('()').split(',')
        latitude = float(coords[0])
        longitude = float(coords[1])

        research_query = f"how to assist with {description} as emergency responder when victim is {mobility}"

        # In parallel: get research and find nearby cases
        search_task = async_valyu_deepsearch(
            query=research_query,
            search_type="all",
            max_num_results=5,
            response_length="short"
        )
        nearby_cases_task = async_get_nearby_cases(latitude, longitude)

        results = await asyncio.gather(search_task, nearby_cases_task, return_exceptions=True)
        
        search_results_raw = results[0]
        nearby_cases = results[1]

        if isinstance(search_results_raw, Exception):
            print(f"Valyu search failed: {search_results_raw}")
            research_success = False
            search_results = {"results_preview": []}
        else:
            search_results = json.loads(search_results_raw)
            research_success = search_results.get("success", False)

        if isinstance(nearby_cases, Exception):
            print(f"Finding nearby cases failed: {nearby_cases}")
            nearby_cases = []


        # Extract relevant content
        if research_success and search_results.get("results_preview"):
            research_summary = "\n".join([
                f"- {r.get('title', 'N/A')}: {r.get('content_preview', 'N/A')[:100]}"
                for r in search_results.get("results_preview", [])[:3]
            ])
        else:
            research_summary = "No research results available. Using general responder guidance."

        # HelperGuideAgent prompt
        guide_prompt = (
            f"You are an emergency response coordinator. Generate guidance for a helper responding to:\n"
            f"- Description: {description}\n"
            f"- Victim mobility: {mobility}\n"
            f"- Urgency: {row['urgency']}\n"
            f"- Danger level: {row['danger_level']}\n"
            f"- People count: {row['people_count'] or 'unknown'}\n\n"
            f"Research results:\n{research_summary}\n\n"
            "Generate exactly 3 actionable steps for the responder to take en route and on arrival. "
            "Keep each step to 1-2 sentences. Focus on safety and effectiveness. "
            "Format as markdown list."
        )

        # Call LLM for guide generation
        body = {
            "team_id": TEAM_ID,
            "api_token": API_TOKEN,
            "model": MODELS["fast"],  # Use Haiku for speed
            "messages": [
                {"role": "user", "content": guide_prompt}
            ],
            "max_tokens": 300
        }

        response = await api_client.post(API_ENDPOINT, json=body)
        response.raise_for_status()
        result = response.json()

        guide_text = result.get("content", [])[0].get("text", "No guidance available.")

        # Save guide
        guide = save_helper_guide(
            assignment_id=assignment_id,
            guide_text=guide_text,
            research_query=research_query,
            research_results_summary=research_summary[:500]  # Truncate
        )

        guide['nearby_cases'] = nearby_cases
        return guide
