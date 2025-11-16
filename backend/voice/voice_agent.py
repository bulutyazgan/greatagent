"""
Conversational Voice Agent

Handles multi-turn dialogue with callers to gather emergency information.
Uses LLM to understand user input and ask clarifying questions.
"""

import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import logging

from main import get_api_session, API_ENDPOINT, MODELS, TEAM_ID, API_TOKEN

logger = logging.getLogger(__name__)


class ConversationState:
    """Tracks conversation state and collected information"""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.messages: List[Dict[str, str]] = []
        self.created_at = datetime.utcnow()

        # Collected information
        self.description: Optional[str] = None
        self.location: Optional[Dict[str, float]] = None
        self.people_count: Optional[int] = None
        self.mobility_status: Optional[str] = None
        self.floor_number: Optional[int] = None
        self.vulnerability_factors: List[str] = []
        self.urgency: Optional[str] = None
        self.danger_level: Optional[str] = None

        # Conversation metadata
        self.turn_count = 0
        self.case_created = False
        self.case_id: Optional[int] = None

    def add_message(self, role: str, content: str):
        """Add message to conversation history"""
        self.messages.append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        })
        if role == "user":
            self.turn_count += 1

    def get_recent_context(self, num_turns: int = 5) -> str:
        """Get recent conversation as formatted string"""
        recent = self.messages[-(num_turns * 2):]  # Get last N user-agent pairs
        return "\n".join([f"{msg['role']}: {msg['content']}" for msg in recent])

    def is_ready_for_case_creation(self) -> bool:
        """Check if we have enough information to create a case"""
        has_description = self.description is not None or any(
            keyword in msg['content'].lower()
            for msg in self.messages
            for keyword in ['fire', 'trapped', 'injured', 'emergency', 'help']
        )
        has_location = self.location is not None

        return has_description and has_location


class VoiceAgent:
    """Conversational agent for voice-based emergency intake"""

    def __init__(self):
        self.api_client = get_api_session()
        self.model_id = MODELS["recommended"]  # Claude 3.5 Sonnet
        self.sessions: Dict[str, ConversationState] = {}

        # System prompt for the agent
        self.system_prompt = """You are an emergency response AI agent helping people in distress. Your role is to:

1. Gather critical information calmly and efficiently
2. Ask ONE clear question at a time
3. Show empathy while staying focused on getting facts
4. Determine urgency level and danger
5. Provide immediate safety advice when appropriate

Information to collect:
- What is the emergency? (fire, injury, trapped, etc.)
- How many people are affected?
- Can they move safely? (mobile, injured, trapped)
- What floor/location details? (if in building)
- Any vulnerable people? (children, elderly, medical needs)

Keep responses SHORT (1-2 sentences). Be calm and professional.
Once you have enough information, say "I have enough information to create your case."
"""

    def start_session(self, session_id: str, location: Optional[Dict[str, float]] = None) -> str:
        """
        Start a new conversation session.

        Args:
            session_id: Unique session identifier
            location: User's GPS coordinates {lat, lng}

        Returns:
            Initial greeting message
        """
        state = ConversationState(session_id)
        if location:
            state.location = location

        self.sessions[session_id] = state

        # Initial greeting
        greeting = "I'm here to help. Please tell me what emergency you're facing right now."
        state.add_message("agent", greeting)

        logger.info(f"Started voice session {session_id}")
        return greeting

    def process_user_input(
        self,
        session_id: str,
        user_message: str,
        location: Optional[Dict[str, float]] = None
    ) -> Dict[str, any]:
        """
        Process user's voice input and generate agent response.

        Args:
            session_id: Session identifier
            user_message: Transcribed user speech
            location: Updated GPS coordinates

        Returns:
            Dict with agent_message, case_created, case_id, etc.
        """
        # Get or create session
        if session_id not in self.sessions:
            self.start_session(session_id, location)

        state = self.sessions[session_id]

        # Update location if provided
        if location:
            state.location = location

        # Add user message
        state.add_message("user", user_message)

        # Extract information from user message
        self._extract_information(state, user_message)

        # Check if ready to create case
        if state.is_ready_for_case_creation() and not state.case_created:
            # Generate final response and create case
            return self._create_case(state)

        # Generate next agent question
        agent_response = self._generate_response(state)
        state.add_message("agent", agent_response)

        return {
            "agent_message": agent_response,
            "case_created": False,
            "session_id": session_id,
            "turn_count": state.turn_count,
            "information_collected": self._get_collected_info(state)
        }

    def _extract_information(self, state: ConversationState, user_message: str) -> None:
        """Extract structured information from user's message"""
        msg_lower = user_message.lower()

        # Extract floor number
        if "floor" in msg_lower:
            import re
            floor_match = re.search(r'(\d+)(?:st|nd|rd|th)?\s*floor', msg_lower)
            if floor_match:
                state.floor_number = int(floor_match.group(1))

        # Determine mobility status
        if any(word in msg_lower for word in ['trapped', "can't move", "stuck"]):
            state.mobility_status = "trapped"
        elif any(word in msg_lower for word in ['injured', 'hurt', 'wounded']):
            state.mobility_status = "injured"

        # Detect vulnerability factors
        if "elderly" in msg_lower or "old" in msg_lower:
            state.vulnerability_factors.append("elderly")
        if "child" in msg_lower or "kid" in msg_lower or "baby" in msg_lower:
            state.vulnerability_factors.append("children_present")
        if "pregnant" in msg_lower:
            state.vulnerability_factors.append("pregnant")

        # Extract people count
        import re
        people_match = re.search(r'(\d+)\s*(?:people|person|of us)', msg_lower)
        if people_match:
            state.people_count = int(people_match.group(1))

        # Build description from all user messages
        user_messages = [msg['content'] for msg in state.messages if msg['role'] == 'user']
        state.description = ' '.join(user_messages)

    def _generate_response(self, state: ConversationState) -> str:
        """Generate agent's next question using LLM"""
        # Build context
        conversation_history = state.get_recent_context(num_turns=5)

        # Build prompt for LLM
        user_prompt = f"""Conversation so far:
{conversation_history}

Information collected:
- Location: {'Yes' if state.location else 'No'}
- Description: {state.description or 'Not yet'}
- Floor: {state.floor_number or 'Unknown'}
- Mobility: {state.mobility_status or 'Unknown'}
- People count: {state.people_count or 'Unknown'}

Generate the next question to ask the caller. Keep it SHORT (1 sentence). Focus on what's most critical."""

        try:
            response = self.api_client.post(
                API_ENDPOINT,
                json={
                    "team_id": TEAM_ID,
                    "api_token": API_TOKEN,
                    "model": self.model_id,
                    "messages": [
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "max_tokens": 150
                },
                timeout=10
            )
            response.raise_for_status()

            result = response.json()
            agent_message = result.get("content", [{}])[0].get("text", "Can you tell me more?")

            return agent_message.strip()

        except Exception as e:
            logger.error(f"Failed to generate response: {e}")
            # Fallback questions based on missing info
            return self._fallback_question(state)

    def _fallback_question(self, state: ConversationState) -> str:
        """Generate fallback question when LLM fails"""
        if not state.mobility_status:
            return "Are you able to move safely, or are you trapped?"

        if not state.floor_number and "building" in state.description.lower():
            return "What floor are you on?"

        if not state.people_count:
            return "How many people need help?"

        return "Is there anything else I should know about your situation?"

    def _create_case(self, state: ConversationState) -> Dict[str, any]:
        """Create emergency case from collected information"""
        # Import here to avoid circular dependency
        import sys
        sys.path.append('/Users/gabriel/Desktop/UCL/forbackend/greatagent/backend')
        from services.cases import create_case

        try:
            # Create case
            case_id = create_case(
                user_id=state.session_id,
                latitude=state.location['lat'] if state.location else 0.0,
                longitude=state.location['lng'] if state.location else 0.0,
                raw_problem_description=state.description or "Emergency via voice call"
            )

            state.case_created = True
            state.case_id = case_id

            # Final confirmation message
            confirmation = (
                "I've created your emergency case. Help is on the way. "
                "You'll receive guidance on what to do while you wait. Stay safe."
            )
            state.add_message("agent", confirmation)

            logger.info(f"Created case {case_id} from voice session {state.session_id}")

            return {
                "agent_message": confirmation,
                "case_created": True,
                "case_id": case_id,
                "session_id": state.session_id,
                "turn_count": state.turn_count,
                "information_collected": self._get_collected_info(state)
            }

        except Exception as e:
            logger.error(f"Failed to create case: {e}")
            return {
                "agent_message": "I'm having trouble creating your case. Please try again or use text mode.",
                "case_created": False,
                "error": str(e)
            }

    def _get_collected_info(self, state: ConversationState) -> Dict[str, any]:
        """Get summary of collected information"""
        return {
            "description": state.description,
            "location": state.location,
            "people_count": state.people_count,
            "mobility_status": state.mobility_status,
            "floor_number": state.floor_number,
            "vulnerability_factors": state.vulnerability_factors,
            "urgency": state.urgency,
            "danger_level": state.danger_level
        }

    def get_session(self, session_id: str) -> Optional[ConversationState]:
        """Get conversation state for a session"""
        return self.sessions.get(session_id)

    def end_session(self, session_id: str) -> None:
        """End and cleanup a session"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            logger.info(f"Ended voice session {session_id}")


# Singleton instance
voice_agent = VoiceAgent()
