import requests
import json
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
from langchain_core.tools import tool

class CaseExtractionResult(BaseModel):
    caller_user_id: Optional[int] = Field(
        description="ID of the caller user if known, otherwise null."
    )
    reported_by_user_id: Optional[int] = Field(
        description="ID of the user who reported the case. For now, same as caller_user_id if known, otherwise null."
    )
    case_group_id: Optional[int] = Field(
        description="Case group id if already known. Use null for new cases; grouping will be done later."
    )
    location: tuple = Field(
        description="Exact coordinates of the incident as a (lat, lon) tuple."
    )
    description: str = Field(
        description="Short free-text description of the situation, cleaned but preserving key details."
    )
    people_count: Optional[int] = Field(
        description="Number of people affected if it can be inferred; otherwise null."
    )
    mobility_status: Optional[Literal["mobile", "injured", "trapped"]] = Field(
        description="Mobility of the people affected. Choose the best guess."
    )
    vulnerability_factors: List[
        Literal["elderly", "children_present", "medical_needs", "disability", "pregnant"]
    ] = Field(
        default_factory=list,
        description="List of vulnerability factors mentioned or strongly implied, can be empty."
    )
    urgency: Literal["low", "medium", "high", "critical"] = Field(
        description="How soon help is needed, best guess based on the message."
    )
    danger_level: Literal["safe", "moderate", "severe", "life_threatening"] = Field(
        description="Risk to the victim(s) at the current moment, best guess even if uncertain."
    )

class CaseExtractionInput(BaseModel):
    user_text: str = Field(
        description="Raw free-text message from the user describing their situation."
    )
    latitude: float = Field(
        description="Latitude from GPS."
    )
    longitude: float = Field(
        description="Longitude from GPS."
    )
    caller_user_id: Optional[int] = Field(
        default=None,
        description="ID of the logged-in caller user, or null for anonymous."
    )

@tool(args_schema=CaseExtractionInput)
def extract_case_from_text(
    user_text: str,
    latitude: float,
    longitude: float,
    caller_user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Extracts a structured case object from raw user text and GPS coordinates.
    Always returns a best-effort guess for urgency and danger_level.
    Does NOT write to the database; it only returns structured data that can be inserted as a new case.
    """
    # For now, this is a placeholder that just wraps the data in the expected format.
    # The LLM agent will be responsible for filling in better guesses later, or you
    # can later replace this body with rule-based heuristics.
    result = CaseExtractionResult(
        caller_user_id=caller_user_id,
        reported_by_user_id=caller_user_id,
        case_group_id=None,
        location=(latitude, longitude),
        description=user_text.strip(),
        people_count=None,  # best guess to be filled by LLM/agent later
        mobility_status=None,
        vulnerability_factors=[],
        urgency="high",              # sensible default for safety
        danger_level="severe",       # sensible default for safety
    )
    return result.dict()

# Remember to add to all_tools
# SAME SYNTAX AS helperAgents branch, initializing what will be list of tools
all_tools = [extract_case_from_text]