"""
Voice Integration Configuration

Manages API keys, voice settings, and WebSocket configurations
for ElevenLabs STT and TTS services.
"""

import os
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()


class VoiceConfig:
    """Configuration for ElevenLabs voice services"""

    # API Configuration
    ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")

    # API Endpoints
    ELEVENLABS_TOKEN_ENDPOINT = "https://api.elevenlabs.io/v1/auth/token"
    ELEVENLABS_STT_WSS = "wss://api.elevenlabs.io/v1/speech-to-text/realtime"
    ELEVENLABS_TTS_WSS = "wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input"

    # STT Configuration
    STT_MODEL_ID = "scribe-realtime-en-v1"
    STT_AUDIO_FORMAT = "pcm_16000"
    STT_COMMIT_STRATEGY = "manual"  # or "vad" for auto-commit
    STT_SAMPLE_RATE = 16000
    STT_ENABLE_LOGGING = True

    # VAD Settings (for auto-commit)
    VAD_SILENCE_THRESHOLD_SECS = 2.5
    VAD_THRESHOLD = 0.4
    MIN_SPEECH_DURATION_MS = 250
    MIN_SILENCE_DURATION_MS = 2500

    # TTS Configuration
    TTS_MODEL_ID = "eleven_turbo_v2_5"  # Fast, high-quality model
    TTS_OUTPUT_FORMAT = "pcm_44100"  # 44.1kHz PCM
    TTS_SAMPLE_RATE = 44100
    TTS_ENABLE_LOGGING = True
    TTS_AUTO_MODE = True  # Reduces latency for full sentences
    TTS_INACTIVITY_TIMEOUT = 20  # seconds

    # Voice Selection
    VOICES = {
        "calm_female": "21m00Tcm4TlvDq8ikWAM",  # Rachel - calm, clear
        "authoritative_male": "pNInz6obpgDQGcFmaJgB",  # Adam - commanding
        "warm_female": "EXAVITQu4vr4xnSDxMaL",  # Sarah - empathetic
        "urgent_male": "VR6AewLTigWG4xSOukaG",  # Arnold - urgent
        "default": "21m00Tcm4TlvDq8ikWAM"  # Default to Rachel
    }

    # Voice Settings
    TTS_VOICE_SETTINGS = {
        "stability": 0.7,  # 0-1: Higher = more consistent
        "similarity_boost": 0.8,  # 0-1: Higher = more accurate
        "speed": 1.0  # 0.5-2.0: Speech speed multiplier
    }

    # Token Configuration
    TOKEN_EXPIRY_SECONDS = 3600  # 1 hour

    # Language Support
    SUPPORTED_LANGUAGES = [
        {"code": "en", "name": "English"},
        {"code": "es", "name": "Spanish"},
        {"code": "fr", "name": "French"},
        {"code": "de", "name": "German"},
        {"code": "zh", "name": "Chinese"},
    ]

    @classmethod
    def get_stt_ws_url(cls, token: str) -> str:
        """Build STT WebSocket URL with query parameters"""
        params = [
            f"model_id={cls.STT_MODEL_ID}",
            f"token={token}",
            f"audio_format={cls.STT_AUDIO_FORMAT}",
            f"commit_strategy={cls.STT_COMMIT_STRATEGY}",
            f"enable_logging={str(cls.STT_ENABLE_LOGGING).lower()}",
            f"include_timestamps=false"
        ]

        if cls.STT_COMMIT_STRATEGY == "vad":
            params.extend([
                f"vad_silence_threshold_secs={cls.VAD_SILENCE_THRESHOLD_SECS}",
                f"vad_threshold={cls.VAD_THRESHOLD}",
                f"min_speech_duration_ms={cls.MIN_SPEECH_DURATION_MS}",
                f"min_silence_duration_ms={cls.MIN_SILENCE_DURATION_MS}"
            ])

        return f"{cls.ELEVENLABS_STT_WSS}?{'&'.join(params)}"

    @classmethod
    def get_tts_ws_url(cls, voice_id: str, token: str) -> str:
        """Build TTS WebSocket URL with query parameters"""
        params = [
            f"authorization={token}",
            f"model_id={cls.TTS_MODEL_ID}",
            f"output_format={cls.TTS_OUTPUT_FORMAT}",
            f"enable_logging={str(cls.TTS_ENABLE_LOGGING).lower()}",
            f"enable_ssml_parsing=false",
            f"auto_mode={str(cls.TTS_AUTO_MODE).lower()}",
            f"sync_alignment=false",
            f"apply_text_normalization=auto",
            f"inactivity_timeout={cls.TTS_INACTIVITY_TIMEOUT}"
        ]

        base_url = cls.ELEVENLABS_TTS_WSS.format(voice_id=voice_id)
        return f"{base_url}?{'&'.join(params)}"

    @classmethod
    def get_voice_id(cls, voice_type: str) -> str:
        """Get voice ID by type (calm_female, urgent_male, etc.)"""
        return cls.VOICES.get(voice_type, cls.VOICES["default"])

    @classmethod
    def validate_config(cls) -> bool:
        """Validate that required configuration is present"""
        if not cls.ELEVENLABS_API_KEY:
            raise ValueError("ELEVENLABS_API_KEY not set in environment")
        return True


# Validate configuration on import
VoiceConfig.validate_config()
