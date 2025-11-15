"""Tool integrations that LangGraph agents can call."""

import json
import os
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union

import requests
from langchain_core.tools import tool
from pydantic import BaseModel, Field, field_validator, model_validator

VALYU_BASE_URL = os.getenv("VALYU_BASE_URL", "https://api.valyu.ai/v1")
VALYU_TIMEOUT = float(os.getenv("VALYU_TIMEOUT", "30"))


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


AVAILABLE_TOOLS = [valyu_deepsearch]
