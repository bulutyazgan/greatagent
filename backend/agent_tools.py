"""Tool integrations that LangGraph agents can call."""

import ast
import json
import os
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union
from math import radians, sin, cos, asin, sqrt

import requests
from langchain_core.tools import tool
from pydantic import BaseModel, Field, field_validator, model_validator

# Initialize MOCK_DB with expected structure for grouping tool
# NOTE: This will be replaced with real database queries in production
MOCK_DB = {
    "cases": {},
    "case_groups": {}
}

# --- Valyu DeepSearch Configuration (from helperAgents) ---
VALYU_BASE_URL = os.getenv("VALYU_BASE_URL", "https://api.valyu.ai/v1")
VALYU_TIMEOUT = float(os.getenv("VALYU_TIMEOUT", "30"))

# --- Case Extraction Models and Tool (from InputProcessingAgent) ---

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

# --- Case Grouping Models and Tool (from groupingAgents) ---

class NewCaseInput(BaseModel):
    case_id: int = Field(description="The ID of the new case being checked/added.")

def haversine(lat1, lon1, lat2, lon2):
    """Returns distance in meters between two lat/lon points"""
    R = 6371000
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    c = 2*asin(sqrt(a))
    return R * c

@tool(args_schema=NewCaseInput)
def process_case_grouping(case_id: int) -> dict:
    """
    Determines if the new case should be added to an existing group or create a new group based on location proximity.
    """
    # Retrieve new case info
    new_case = MOCK_DB["cases"].get(str(case_id))
    if not new_case:
        return {"error": "Case not found."}
    if new_case.get("status") != "open":
        return {"error": "Case not open."}
    lat1, lon1 = ast.literal_eval(new_case["location"])
    # Find all other open cases, excluding this one
    open_cases = [
        v for k, v in MOCK_DB["cases"].items()
        if v.get("status") == "open" and int(k) != case_id
    ]
    # Proximity filter
    nearby_cases = []
    for v in open_cases:
        lat2, lon2 = ast.literal_eval(v["location"])
        if haversine(lat1, lon1, lat2, lon2) <= 500:
            nearby_cases.append(int(v["id"]))
    # Only make group if >=2 others found (3+ total)
    if len(nearby_cases) + 1 >= 3:
        # Create group id
        group_id = max([int(x) for x in MOCK_DB.get("case_groups", {}).keys()] or [0]) + 1
        case_ids = [case_id] + nearby_cases
        if "case_groups" not in MOCK_DB:
            MOCK_DB["case_groups"] = {}
        MOCK_DB["case_groups"][str(group_id)] = {"case_ids": case_ids, "description": "Proximity group"}
        # Assign group id to all involved cases
        for cid in case_ids:
            MOCK_DB["cases"][str(cid)]["case_group_id"] = group_id
        return {"group_created": True, "case_group_id": group_id, "cases": case_ids}
    else:
        return {"group_created": False, "cases_found": [case_id] + nearby_cases}

# --- Valyu DeepSearch Tool (from helperAgents) ---

class ValyuSearchInput(BaseModel):
    """Schema for Valyu DeepSearch calls."""

    query: str = Field(
        ...,
        description="Natural language query that should be sent to Valyu's DeepSearch API.",
    )
    max_num_results: int = Field(
        5,
        ge=1,
        le=20,
        description="Maximum number of search results to return (1-20).",
    )
    search_type: Literal["all", "web", "proprietary"] = Field(
        "all",
        description="Data domains to search (web, proprietary datasets, or both).",
    )
    response_length: Optional[Union[Literal["short", "medium", "large", "max"], int]] = Field(
        "short",
        description="Length of each result. Either a preset string or an explicit character limit.",
    )
    max_price: Optional[float] = Field(
        None,
        ge=0,
        description="Maximum CPM the query is allowed to consume (USD per thousand characters).",
    )
    relevance_threshold: Optional[float] = Field(
        None,
        ge=0,
        le=1,
        description="Drop results whose relevance score falls below this threshold (0-1).",
    )
    fast_mode: bool = Field(
        False,
        description="Return answers faster (but shorter) by enabling Valyu's fast mode.",
    )
    included_sources: Optional[List[str]] = Field(
        None,
        description="Limit the search to specific domains, URLs, or dataset identifiers.",
    )
    excluded_sources: Optional[List[str]] = Field(
        None,
        description="Sources that should be ignored for this search.",
    )
    category: Optional[str] = Field(
        None,
        description="Hint that steers the search to a domain (e.g. 'financial filings').",
    )
    start_date: Optional[str] = Field(
        None,
        description="Filter results published after this ISO date (YYYY-MM-DD).",
    )
    end_date: Optional[str] = Field(
        None,
        description="Filter results published before this ISO date (YYYY-MM-DD).",
    )
    country_code: Optional[str] = Field(
        None,
        description="Two-letter ISO country code to bias results (e.g. 'US').",
    )
    is_tool_call: bool = Field(
        True,
        description="Tell Valyu the request originates from an agent/tool to optimize retrieval.",
    )

    @field_validator("start_date", "end_date")
    @classmethod
    def _validate_dates(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError as exc:  # pragma: no cover - defensive guardrail
            raise ValueError("Dates must use YYYY-MM-DD format") from exc
        return value

    @field_validator("response_length")
    @classmethod
    def _validate_response_length(
        cls, value: Optional[Union[str, int]]
    ) -> Optional[Union[str, int]]:
        if isinstance(value, int) and value < 1:
            raise ValueError("response_length integers must be > 0")
        return value

    @field_validator("country_code")
    @classmethod
    def _normalize_country_code(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip().upper()
        if len(normalized) != 2:
            raise ValueError("country_code must be a two-letter ISO code")
        return normalized

    @model_validator(mode="after")
    def _validate_source_filters(self) -> "ValyuSearchInput":
        if self.included_sources and self.excluded_sources:
            raise ValueError("Use either included_sources or excluded_sources, not both.")
        return self


def _require_valyu_api_key() -> str:
    api_key = os.getenv("VALYU_API_KEY")
    if not api_key:
        raise RuntimeError(
            "VALYU_API_KEY is not set. Add it to your environment or .env file."
        )
    return api_key


def _format_valyu_results(payload: Dict[str, Any], preview_results: int = 3) -> Dict[str, Any]:
    """Keep only the metadata our agents will actually need."""

    condensed: List[Dict[str, Any]] = []
    for idx, item in enumerate(payload.get("results", [])[:preview_results], start=1):
        snippet = (item.get("content") or "").strip()
        if len(snippet) > 500:
            snippet = snippet[:500].rstrip() + "…"
        condensed.append(
            {
                "rank": idx,
                "title": item.get("title"),
                "url": item.get("url"),
                "source": item.get("source"),
                "source_type": item.get("source_type"),
                "relevance_score": item.get("relevance_score"),
                "price": item.get("price"),
                "publication_date": item.get("publication_date"),
                "content_preview": snippet,
            }
        )

    return {
        "success": payload.get("success"),
        "error": payload.get("error"),
        "tx_id": payload.get("tx_id"),
        "query": payload.get("query"),
        "results_preview": condensed,
        "results_by_source": payload.get("results_by_source"),
        "total_cost_dollars": payload.get("total_deduction_dollars")
        or payload.get("total_cost_dollars"),
        "total_characters": payload.get("total_characters"),
    }


def _invoke_valyu(payload: Dict[str, Any]) -> Dict[str, Any]:
    api_key = _require_valyu_api_key()
    response = requests.post(
        f"{VALYU_BASE_URL.rstrip('/')}/deepsearch",
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        json=payload,
        timeout=VALYU_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


@tool("valyu_deepsearch", args_schema=ValyuSearchInput)
def valyu_deepsearch(**tool_kwargs: Any) -> str:
    """Search the public web, research papers, and premium Valyu datasets for up-to-date context."""

    params = ValyuSearchInput(**tool_kwargs)
    payload: Dict[str, Any] = {"query": params.query}

    optional_fields = {
        "max_num_results": params.max_num_results,
        "search_type": params.search_type,
        "response_length": params.response_length,
        "max_price": params.max_price,
        "relevance_threshold": params.relevance_threshold,
        "fast_mode": params.fast_mode,
        "included_sources": params.included_sources,
        "excluded_sources": params.excluded_sources,
        "category": params.category,
        "start_date": params.start_date,
        "end_date": params.end_date,
        "country_code": params.country_code,
        "is_tool_call": params.is_tool_call,
    }

    for key, value in optional_fields.items():
        if value is not None:
            payload[key] = value

    try:
        data = _invoke_valyu(payload)
    except requests.HTTPError as exc:
        error_payload = {
            "success": False,
            "error": f"HTTP {exc.response.status_code}: {exc.response.text}",
        }
        return json.dumps(error_payload)
    except requests.RequestException as exc:
        return json.dumps({"success": False, "error": str(exc)})
    except RuntimeError as exc:
        return json.dumps({"success": False, "error": str(exc)})

    return json.dumps(_format_valyu_results(data))


# --- All Tools List ---
# Unified list of all available tools for agents
AVAILABLE_TOOLS = [
    extract_case_from_text,
    process_case_grouping,
    valyu_deepsearch
]

# Legacy alias for backward compatibility
all_tools = AVAILABLE_TOOLS
