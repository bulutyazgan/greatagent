"""
Text-to-Speech Service

Handles token generation for ElevenLabs TTS WebSocket API.
Frontend connects directly to ElevenLabs WebSocket for audio streaming.
"""

import requests
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging

from .config import VoiceConfig

logger = logging.getLogger(__name__)


class TTSService:
    """Service for Text-to-Speech token generation"""

    def __init__(self):
        self.config = VoiceConfig
        self._token_cache: Dict[str, Dict] = {}  # session_id -> {token, expires_at}

    def generate_token(
        self,
        session_id: str,
        voice_type: str = "calm_female",
        urgency: Optional[str] = None,
        role: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Generate a single-use token for TTS WebSocket connection.

        Args:
            session_id: Unique session identifier
            voice_type: Type of voice (calm_female, urgent_male, etc.)
            urgency: Case urgency level (low, medium, high, critical)
            role: User role (caller or helper)

        Returns:
            Dict with 'token', 'ws_url', and 'voice_id' keys

        Raises:
            Exception: If token generation fails
        """
        try:
            # Auto-select voice based on context
            if urgency or role:
                voice_type = self._select_voice_by_context(urgency, role)

            voice_id = self.config.get_voice_id(voice_type)

            # Check cache
            cache_key = f"{session_id}:{voice_id}"
            if cache_key in self._token_cache:
                cached = self._token_cache[cache_key]
                if datetime.utcnow() < cached['expires_at']:
                    logger.info(f"Using cached TTS token for session {session_id}")
                    return {
                        "token": cached['token'],
                        "ws_url": self.config.get_tts_ws_url(voice_id, cached['token']),
                        "voice_id": voice_id,
                        "voice_type": voice_type
                    }

            # Generate new token
            response = requests.post(
                self.config.ELEVENLABS_TOKEN_ENDPOINT,
                headers={
                    "xi-api-key": self.config.ELEVENLABS_API_KEY,
                    "Content-Type": "application/json"
                },
                json={
                    "scope": "text_to_speech",
                    "expires_in": self.config.TOKEN_EXPIRY_SECONDS
                },
                timeout=10
            )
            response.raise_for_status()

            token_data = response.json()
            token = token_data["token"]

            # Cache token
            self._token_cache[cache_key] = {
                "token": token,
                "expires_at": datetime.utcnow() + timedelta(
                    seconds=self.config.TOKEN_EXPIRY_SECONDS - 60
                )
            }

            logger.info(f"Generated new TTS token for session {session_id}, voice: {voice_type}")

            return {
                "token": token,
                "ws_url": self.config.get_tts_ws_url(voice_id, token),
                "voice_id": voice_id,
                "voice_type": voice_type,
                "voice_settings": self.config.TTS_VOICE_SETTINGS,
                "expires_in": self.config.TOKEN_EXPIRY_SECONDS
            }

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to generate TTS token: {e}")
            raise Exception(f"TTS token generation failed: {str(e)}")

    def _select_voice_by_context(
        self,
        urgency: Optional[str],
        role: Optional[str]
    ) -> str:
        """
        Automatically select appropriate voice based on context.

        Args:
            urgency: Case urgency (low, medium, high, critical)
            role: User role (caller, helper)

        Returns:
            Voice type key
        """
        # For callers (victims)
        if role == "caller":
            if urgency in ["critical", "high"]:
                return "urgent_male"  # Strong, clear voice for critical situations
            else:
                return "calm_female"  # Soothing voice for calmer situations

        # For helpers (responders)
        if role == "helper":
            return "authoritative_male"  # Commanding voice for instructions

        # Default
        return "calm_female"

    def invalidate_token(self, session_id: str) -> None:
        """Invalidate all cached tokens for a session"""
        keys_to_delete = [k for k in self._token_cache.keys() if k.startswith(session_id)]
        for key in keys_to_delete:
            del self._token_cache[key]
            logger.info(f"Invalidated TTS token: {key}")

    def get_available_voices(self) -> Dict[str, Dict]:
        """Get list of available voices with descriptions"""
        return {
            "calm_female": {
                "id": self.config.VOICES["calm_female"],
                "name": "Rachel",
                "description": "Calm, clear, professional",
                "use_case": "General guidance, soothing instructions"
            },
            "authoritative_male": {
                "id": self.config.VOICES["authoritative_male"],
                "name": "Adam",
                "description": "Authoritative, deep, commanding",
                "use_case": "Helper instructions, action plans"
            },
            "warm_female": {
                "id": self.config.VOICES["warm_female"],
                "name": "Sarah",
                "description": "Warm, empathetic, reassuring",
                "use_case": "Confirmations, emotional support"
            },
            "urgent_male": {
                "id": self.config.VOICES["urgent_male"],
                "name": "Arnold",
                "description": "Strong, urgent, alert",
                "use_case": "Critical warnings, urgent instructions"
            }
        }

    def get_config_for_frontend(self) -> Dict[str, any]:
        """Get configuration settings for frontend"""
        return {
            "sample_rate": self.config.TTS_SAMPLE_RATE,
            "output_format": self.config.TTS_OUTPUT_FORMAT,
            "voice_settings": self.config.TTS_VOICE_SETTINGS,
            "available_voices": self.get_available_voices()
        }


# Singleton instance
tts_service = TTSService()
