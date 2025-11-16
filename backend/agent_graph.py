import os
import json
import logging
import time
from typing import Literal

# Setup logging for audit trail
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("beacon_agents")

# LangSmith setup (must be before imports)
# Check if LangSmith is configured
LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY")
if LANGSMITH_API_KEY:
    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGSMITH_ENDPOINT"] = "https://api.smith.langchain.com"
    logger.info("LangSmith tracing enabled")
else:
    logger.warning("LANGSMITH_API_KEY not set. Tracing will not be recorded.")
    os.environ["LANGSMITH_TRACING"] = "false"


from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langsmith import Client, traceable

# --- 1. Import from our other files ---
from main import get_api_session, API_ENDPOINT, MODELS, TEAM_ID, API_TOKEN, LANGSMITH_PROJECT
from agent_state import AgentState
import agent_tools


api_client = get_api_session()
model_id = MODELS["recommended"]
fast_model_id = MODELS["fast"]

# Initialize LangSmith client for metadata/feedback
ls_client = Client()

# Initialize workflow
workflow = StateGraph(AgentState)

# --- Intake Agent (from InputProcessingAgent) ---
@traceable(name="intake_agent", tags=["extraction", "user_input"])
def intake_agent(state: AgentState):
    """
    Intake agent: turns raw user text + GPS into a structured case object.
    Does NOT write to DB; only populates state['case_context'] with the extracted fields.
    Traces to LangSmith with full execution details.
    """
    logger.info("Starting intake_agent")
    start_time = time.time()
    
    messages = state["messages"]
    last_user_msg = None
    for m in reversed(messages):
        if m.get("role") == "user":
            last_user_msg = m.get("content")
            break

    latitude = state.get("latitude")
    longitude = state.get("longitude")
    caller_user_id = state.get("caller_user_id")

    # Validation with logging
    if last_user_msg is None or latitude is None or longitude is None:
        error_msg = "Could not extract case: missing text or location."
        logger.warning(f"intake_agent failed: {error_msg}")
        return {
            "messages": [{"role": "assistant", "content": error_msg}],
            "case_context": None,
        }

    # System prompt describing the schema we want
    system_prompt = (
        "You are an emergency intake agent. Your job is to read a user's free-text "
        "message describing an emergency and infer as much structured information as possible. "
        "Always return JSON strictly matching this Python dict schema:\n\n"
        "{\n"
        '  "caller_user_id": int | null,\n'
        '  "reported_by_user_id": int | null,\n'
        '  "case_group_id": null,\n'
        '  "location": [lat: float, lon: float],\n'
        '  "description": str,\n'
        '  "people_count": int | null,\n'
        '  "mobility_status": "mobile" | "injured" | "trapped" | null,\n'
        '  "vulnerability_factors": list of '
        '["elderly","children_present","medical_needs","disability","pregnant"],\n'
        '  "urgency": "low" | "medium" | "high" | "critical",\n'
        '  "danger_level": "safe" | "moderate" | "severe" | "life_threatening"\n'
        "}\n\n"
        "Always make a best guess. If unsure, use null for optional fields, "
        'urgency = "high", and danger_level = "severe". '
        "Do not include any extra keys or text outside the JSON."
    )

    body = {
        "team_id": TEAM_ID,
        "api_token": API_TOKEN,
        "model": model_id,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"User text: {last_user_msg}\n"
                    f"Latitude: {latitude}\n"
                    f"Longitude: {longitude}\n"
                    f"Caller user id: {caller_user_id}"
                ),
            },
        ],
        "max_tokens": 512,
        # No tools here; pure structured generation
    }

    try:
        response = api_client.post(API_ENDPOINT, json=body, timeout=30)
        response.raise_for_status()
        result = response.json()

        # Depending on Holistic response format; assuming first content item is JSON text
        raw_content = result.get("content", [])[0].get("text", "{}")
        case_obj = json.loads(raw_content)
    except Exception as e:
        logger.error(f"LLM call failed: {e}. Using fallback.")
        case_obj = {
            "caller_user_id": caller_user_id,
            "reported_by_user_id": caller_user_id,
            "case_group_id": None,
            "location": [latitude, longitude],
            "description": last_user_msg,
            "people_count": None,
            "mobility_status": None,
            "vulnerability_factors": [],
            "urgency": "high",
            "danger_level": "severe",
        }

    elapsed = time.time() - start_time
    logger.info(f"intake_agent completed in {elapsed:.3f}s")

    confirmation_msg = (
        f"Created structured case object at location ({latitude}, {longitude}). "
        f"Urgency: {case_obj.get('urgency')}, danger_level: {case_obj.get('danger_level')}."
    )

    return {
        "messages": [{"role": "assistant", "content": confirmation_msg}],
        "case_context": case_obj,
    }

# --- Case Group Manager Agent (from groupingAgents) ---
@traceable(name="case_group_manager", tags=["grouping", "proximity"])
def case_group_manager_agent(state: AgentState):
    """
    Case group manager: checks if a new case should be grouped with nearby cases.
    Traces proximity logic and grouping outcomes.
    """
    logger.info("Starting case_group_manager_agent")
    start_time = time.time()
    
    case_id = state.get("case_id") or (state.get("case_context") or {}).get("id")
    if not case_id:
        logger.warning("case_group_manager: No case ID provided")
        return {"messages": [{"role": "assistant", "content": "No case ID provided."}]}
    
    # Call grouping tool
    try:
        grouping_result = agent_tools.process_case_grouping(case_id=case_id)
        
        if grouping_result.get("group_created"):
            msg = f"Case group {grouping_result['case_group_id']} created for cases: {grouping_result['cases']}."
            logger.info(f"Group created: {grouping_result['case_group_id']}")
        else:
            msg = f"No new group created. Nearby open cases: {grouping_result['cases_found']}."
            logger.info(f"No grouping needed: {len(grouping_result['cases_found'])} nearby cases")
        
        elapsed = time.time() - start_time
        logger.info(f"case_group_manager_agent completed in {elapsed:.3f}s")
        
        return {"messages": [{"role": "assistant", "content": msg}], "case_group_update": grouping_result}
    except Exception as e:
        logger.error(f"case_group_manager_agent failed: {e}")
        elapsed = time.time() - start_time
        logger.info(f"case_group_manager_agent completed (with error) in {elapsed:.3f}s")
        return {
        "messages": [{"role": "assistant", "content": f"Grouping check skipped: {str(e)}"}],
        "case_group_update": {"error": str(e), "group_created": False}
        }

# --- Helper function for conditional routing ---
def should_continue(state: AgentState):
    """Placeholder for routing logic"""
    return END

# --- Coordinator function ---
def coordinator(state: AgentState):
    """Routes between different agents based on state"""
    last_message = state["messages"][-1]
    # If new case created, route to case group manager
    if "new case created" in last_message.get("content", ""):
        return "case_group_manager"
    # Otherwise check if we should continue
    else:
        return should_continue(state)

# --- Build the workflow graph ---
workflow.add_node("intake_agent", intake_agent)
workflow.add_node("case_group_manager", case_group_manager_agent)

# Set intake_agent as entry point for new help calls
workflow.set_entry_point("intake_agent")

# Add routing logic (this can be customized based on your needs)
# Example: After intake, could route to case_group_manager or end
workflow.add_conditional_edges(
    "intake_agent",
    coordinator,
    {"case_group_manager": "case_group_manager", END: END}
)
workflow.add_edge("case_group_manager", END)

# --- Helper Tools Integration (from helperAgents) ---
# Expose a ready-to-use ToolNode so agent chains can call Valyu DeepSearch.
tool_node = ToolNode(agent_tools.AVAILABLE_TOOLS)

app = workflow.compile()

def build_search_graph():
    """Simple graph that just routes requests straight to the tool suite."""
    search_workflow = StateGraph(AgentState)
    search_workflow.add_node("tool_executor", tool_node)
    search_workflow.set_entry_point("tool_executor")
    search_workflow.add_edge("tool_executor", END)
    return search_workflow.compile()
