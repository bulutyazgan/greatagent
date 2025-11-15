from typing import TypedDict, Annotated, List, Dict, Any, Optional
from langgraph.graph import add_messages
import operator

# This is the "memory" of our agent graph.
# It defines the structure of the data that is passed
# between all the nodes (agents) in our graph.
# It's our "dispatch ticket" for a single operation.

class AgentState(TypedDict):
    
    # 'messages' is the core chat history.
    # 'add_messages' is a special function from LangGraph
    # that appends new messages to this list.
    messages: Annotated[List, add_messages]
    
    # We will track which "IDs" we are working on,
    # matching your 3-layer database schema.
    emergency_id: Optional[int]
    case_group_id: Optional[int]
    case_id: Optional[int]
    
    # This will hold the structured data for the current case,
    # pulled from the database by a tool.
    # e.g., {"location": "...", "description": "...", "status": "open"}
    case_context: Optional[Dict[str, Any]]

    # A scratchpad for the Coordinator to pass
    # specific instructions to other specialist agents.
    current_task: Optional[str]
    
    # This will hold the final response to send to the user
    final_response: Optional[str]
    
    # add these if you want GPS in the state
    latitude: Optional[float]
    longitude: Optional[float]
    caller_user_id: Optional[int]