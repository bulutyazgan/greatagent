"""
Voice Integration Module for Beacon Emergency Response System

This module provides bidirectional voice communication between callers and the AI agent:
- Speech-to-Text (STT): ElevenLabs real-time transcription
- Text-to-Speech (TTS): ElevenLabs voice synthesis
- Conversational Agent: Multi-turn dialogue for emergency intake
"""

from .stt_service import STTService
from .tts_service import TTSService
from .voice_agent import VoiceAgent
from .audio_utils import AudioUtils

__all__ = [
    'STTService',
    'TTSService',
    'VoiceAgent',
    'AudioUtils'
]
