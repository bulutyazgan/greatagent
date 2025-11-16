"""
Voice Integration API Routes

FastAPI routes for voice services:
- STT token generation
- TTS token generation
- Voice agent conversation processing
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import logging
import uuid

from .stt_service import stt_service
from .tts_service import tts_service
from .voice_agent import voice_agent
from .audio_utils import AudioUtils

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])


# ==================== Request/Response Models ====================

class STTTokenRequest(BaseModel):
    session_id: Optional[str] = Field(None, description="Optional session ID (generated if not provided)")
    language_code: str = Field("en", description="ISO 639-1 language code")


class STTTokenResponse(BaseModel):
    token: str
    ws_url: str
    session_id: str
    expires_in: int
    config: Dict


class TTSTokenRequest(BaseModel):
    session_id: Optional[str] = None
    voice_type: str = Field("calm_female", description="Voice type: calm_female, urgent_male, etc.")
    urgency: Optional[str] = Field(None, description="Case urgency: low, medium, high, critical")
    role: Optional[str] = Field(None, description="User role: caller or helper")


class TTSTokenResponse(BaseModel):
    token: str
    ws_url: str
    voice_id: str
    voice_type: str
    voice_settings: Dict
    session_id: str
    expires_in: int


class VoiceAgentRequest(BaseModel):
    session_id: Optional[str] = None
    user_message: str = Field(..., description="Transcribed user speech")
    location: Optional[Dict[str, float]] = Field(None, description="GPS coordinates {lat, lng}")
    start_new_session: bool = Field(False, description="Force start new session")


class VoiceAgentResponse(BaseModel):
    agent_message: str
    case_created: bool
    case_id: Optional[int] = None
    session_id: str
    turn_count: int
    information_collected: Dict


# ==================== Routes ====================

@router.post("/stt/token", response_model=STTTokenResponse)
async def generate_stt_token(request: STTTokenRequest):
    """
    Generate authentication token for Speech-to-Text WebSocket.

    Frontend uses this token to connect to ElevenLabs STT WebSocket API.
    Token is single-use and expires after 1 hour.
    """
    try:
        # Generate or use provided session ID
        session_id = request.session_id or str(uuid.uuid4())

        # Validate session ID
        if not AudioUtils.validate_session_id(session_id):
            raise HTTPException(400, "Invalid session_id format")

        # Validate language code
        if request.language_code not in ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko']:
            logger.warning(f"Unsupported language: {request.language_code}, defaulting to 'en'")
            request.language_code = 'en'

        # Generate token
        token_data = stt_service.generate_token(
            session_id=session_id,
            language_code=request.language_code
        )

        return STTTokenResponse(
            token=token_data["token"],
            ws_url=token_data["ws_url"],
            session_id=session_id,
            expires_in=token_data["expires_in"],
            config=stt_service.get_config_for_frontend()
        )

    except Exception as e:
        logger.error(f"STT token generation failed: {e}")
        raise HTTPException(500, f"Failed to generate STT token: {str(e)}")


@router.post("/tts/token", response_model=TTSTokenResponse)
async def generate_tts_token(request: TTSTokenRequest):
    """
    Generate authentication token for Text-to-Speech WebSocket.

    Frontend uses this token to connect to ElevenLabs TTS WebSocket API.
    Automatically selects appropriate voice based on urgency and role.
    """
    try:
        # Generate or use provided session ID
        session_id = request.session_id or str(uuid.uuid4())

        # Validate session ID
        if not AudioUtils.validate_session_id(session_id):
            raise HTTPException(400, "Invalid session_id format")

        # Generate token
        token_data = tts_service.generate_token(
            session_id=session_id,
            voice_type=request.voice_type,
            urgency=request.urgency,
            role=request.role
        )

        return TTSTokenResponse(
            token=token_data["token"],
            ws_url=token_data["ws_url"],
            voice_id=token_data["voice_id"],
            voice_type=token_data["voice_type"],
            voice_settings=token_data["voice_settings"],
            session_id=session_id,
            expires_in=token_data["expires_in"]
        )

    except Exception as e:
        logger.error(f"TTS token generation failed: {e}")
        raise HTTPException(500, f"Failed to generate TTS token: {str(e)}")


@router.post("/agent/process", response_model=VoiceAgentResponse)
async def process_voice_message(request: VoiceAgentRequest):
    """
    Process user's voice input in conversational mode.

    Agent asks follow-up questions until enough information is gathered,
    then creates emergency case.
    """
    try:
        # Generate session ID if not provided
        session_id = request.session_id or str(uuid.uuid4())

        # Validate session ID
        if not AudioUtils.validate_session_id(session_id):
            raise HTTPException(400, "Invalid session_id format")

        # Sanitize user input
        user_message = AudioUtils.sanitize_transcript(request.user_message)

        if not user_message.strip():
            raise HTTPException(400, "Empty user message")

        # Start new session if requested or if session doesn't exist
        if request.start_new_session or not voice_agent.get_session(session_id):
            voice_agent.start_session(session_id, request.location)

        # Process user input
        result = voice_agent.process_user_input(
            session_id=session_id,
            user_message=user_message,
            location=request.location
        )

        return VoiceAgentResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice agent processing failed: {e}")
        raise HTTPException(500, f"Failed to process voice message: {str(e)}")


@router.get("/agent/session/{session_id}")
async def get_session_info(session_id: str):
    """
    Get conversation session information.

    Returns conversation history and collected information.
    """
    try:
        if not AudioUtils.validate_session_id(session_id):
            raise HTTPException(400, "Invalid session_id format")

        session = voice_agent.get_session(session_id)

        if not session:
            raise HTTPException(404, "Session not found")

        return {
            "session_id": session_id,
            "created_at": session.created_at.isoformat(),
            "turn_count": session.turn_count,
            "case_created": session.case_created,
            "case_id": session.case_id,
            "messages": session.messages,
            "information_collected": {
                "description": session.description,
                "location": session.location,
                "people_count": session.people_count,
                "mobility_status": session.mobility_status,
                "floor_number": session.floor_number,
                "vulnerability_factors": session.vulnerability_factors
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get session info: {e}")
        raise HTTPException(500, str(e))


@router.delete("/agent/session/{session_id}")
async def end_session(session_id: str):
    """
    End and cleanup a conversation session.
    """
    try:
        if not AudioUtils.validate_session_id(session_id):
            raise HTTPException(400, "Invalid session_id format")

        voice_agent.end_session(session_id)

        # Also invalidate cached tokens
        stt_service.invalidate_token(session_id)
        tts_service.invalidate_token(session_id)

        return {"message": "Session ended successfully", "session_id": session_id}

    except Exception as e:
        logger.error(f"Failed to end session: {e}")
        raise HTTPException(500, str(e))


@router.get("/voices")
async def get_available_voices():
    """
    Get list of available TTS voices with descriptions.
    """
    try:
        return {
            "voices": tts_service.get_available_voices(),
            "default": "calm_female"
        }
    except Exception as e:
        logger.error(f"Failed to get voices: {e}")
        raise HTTPException(500, str(e))


@router.get("/config")
async def get_voice_config():
    """
    Get voice service configuration for frontend.
    Does NOT include API keys.
    """
    try:
        return {
            "stt": stt_service.get_config_for_frontend(),
            "tts": tts_service.get_config_for_frontend()
        }
    except Exception as e:
        logger.error(f"Failed to get config: {e}")
        raise HTTPException(500, str(e))


@router.get("/health")
async def voice_health_check():
    """Health check for voice services"""
    try:
        # Check if API key is configured
        from .config import VoiceConfig
        has_api_key = bool(VoiceConfig.ELEVENLABS_API_KEY)

        return {
            "status": "healthy" if has_api_key else "degraded",
            "api_key_configured": has_api_key,
            "services": {
                "stt": "available",
                "tts": "available",
                "voice_agent": "available"
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }
