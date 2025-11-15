import json
from typing import Literal

from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

# --- 1. Import from our other files ---
from main import get_api_session, API_ENDPOINT, MODELS, TEAM_ID, API_TOKEN
from agent_state import AgentState
import agent_tools

api_client = get_api_session()
model_id = MODELS["recommended"]

# Expose a ready-to-use ToolNode so agent chains can call Valyu DeepSearch.
tool_node = ToolNode(agent_tools.AVAILABLE_TOOLS)


def build_search_graph():
    """Simple graph that just routes requests straight to the tool suite."""

    workflow = StateGraph(AgentState)
    workflow.add_node("tool_executor", tool_node)
    workflow.set_entry_point("tool_executor")
    workflow.add_edge("tool_executor", END)
    return workflow.compile()
