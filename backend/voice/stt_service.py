"""
Speech-to-Text Service

Handles token generation for ElevenLabs STT WebSocket API.
Frontend connects directly to ElevenLabs WebSocket for real-time transcription.
"""

import requests
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging

from .config import VoiceConfig

logger = logging.getLogger(__name__)


class STTService:
    """Service for Speech-to-Text token generation"""

    def __init__(self):
        self.config = VoiceConfig
        self._token_cache: Dict[str, Dict] = {}  # session_id -> {token, expires_at}

    def generate_token(
        self,
        session_id: str,
        language_code: str = "en"
    ) -> Dict[str, str]:
        """
        Generate a single-use token for STT WebSocket connection.

        Args:
            session_id: Unique session identifier (user_id or anonymous UUID)
            language_code: ISO 639-1 language code (en, es, fr, etc.)

        Returns:
            Dict with 'token' and 'ws_url' keys

        Raises:
            Exception: If token generation fails
        """
        try:
            # Check cache first
            if session_id in self._token_cache:
                cached = self._token_cache[session_id]
                if datetime.utcnow() < cached['expires_at']:
                    logger.info(f"Using cached STT token for session {session_id}")
                    return {
                        "token": cached['token'],
                        "ws_url": self.config.get_stt_ws_url(cached['token'])
                    }

            # Generate new token
            response = requests.post(
                self.config.ELEVENLABS_TOKEN_ENDPOINT,
                headers={
                    "xi-api-key": self.config.ELEVENLABS_API_KEY,
                    "Content-Type": "application/json"
                },
                json={
                    "scope": "speech_to_text",
                    "expires_in": self.config.TOKEN_EXPIRY_SECONDS
                },
                timeout=10
            )
            response.raise_for_status()

            token_data = response.json()
            token = token_data["token"]

            # Cache token
            self._token_cache[session_id] = {
                "token": token,
                "expires_at": datetime.utcnow() + timedelta(
                    seconds=self.config.TOKEN_EXPIRY_SECONDS - 60  # 1 min buffer
                )
            }

            logger.info(f"Generated new STT token for session {session_id}")

            return {
                "token": token,
                "ws_url": self.config.get_stt_ws_url(token),
                "expires_in": self.config.TOKEN_EXPIRY_SECONDS
            }

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to generate STT token: {e}")
            raise Exception(f"STT token generation failed: {str(e)}")

    def invalidate_token(self, session_id: str) -> None:
        """Invalidate cached token for a session"""
        if session_id in self._token_cache:
            del self._token_cache[session_id]
            logger.info(f"Invalidated STT token for session {session_id}")

    def get_config_for_frontend(self) -> Dict[str, any]:
        """
        Get configuration settings needed by frontend.
        Does NOT include API key.
        """
        return {
            "sample_rate": self.config.STT_SAMPLE_RATE,
            "audio_format": self.config.STT_AUDIO_FORMAT,
            "commit_strategy": self.config.STT_COMMIT_STRATEGY,
            "languages": self.config.SUPPORTED_LANGUAGES
        }


# Singleton instance
stt_service = STTService()
