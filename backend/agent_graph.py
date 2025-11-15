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
