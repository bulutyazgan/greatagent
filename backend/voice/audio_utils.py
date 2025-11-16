"""
Audio Utilities

Helper functions for audio processing, validation, and format conversion.
"""

import base64
import struct
from typing import List, Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class AudioUtils:
    """Utility functions for audio processing"""

    @staticmethod
    def validate_audio_chunk(audio_base64: str) -> bool:
        """
        Validate that audio chunk is properly formatted base64.

        Args:
            audio_base64: Base64 encoded audio data

        Returns:
            True if valid, False otherwise
        """
        try:
            # Try to decode
            audio_bytes = base64.b64decode(audio_base64)
            # Check minimum size (should be at least a few bytes)
            return len(audio_bytes) > 0
        except Exception as e:
            logger.error(f"Invalid audio chunk: {e}")
            return False

    @staticmethod
    def pcm16_to_float32(pcm_data: bytes) -> List[float]:
        """
        Convert PCM16 audio data to Float32 format.

        Args:
            pcm_data: Raw PCM16 bytes

        Returns:
            List of float32 samples (-1.0 to 1.0)
        """
        # Unpack PCM16 (signed 16-bit integers)
        num_samples = len(pcm_data) // 2
        pcm_samples = struct.unpack(f'{num_samples}h', pcm_data)

        # Convert to float32 (-1.0 to 1.0)
        float_samples = [sample / 32768.0 for sample in pcm_samples]

        return float_samples

    @staticmethod
    def float32_to_pcm16(float_samples: List[float]) -> bytes:
        """
        Convert Float32 audio samples to PCM16 format.

        Args:
            float_samples: List of float samples (-1.0 to 1.0)

        Returns:
            Raw PCM16 bytes
        """
        # Clamp and convert to PCM16
        pcm_samples = []
        for sample in float_samples:
            # Clamp to [-1.0, 1.0]
            clamped = max(-1.0, min(1.0, sample))
            # Convert to 16-bit integer
            pcm_value = int(clamped * 32767) if clamped >= 0 else int(clamped * 32768)
            pcm_samples.append(pcm_value)

        # Pack as bytes
        pcm_data = struct.pack(f'{len(pcm_samples)}h', *pcm_samples)

        return pcm_data

    @staticmethod
    def calculate_audio_duration(
        data_size_bytes: int,
        sample_rate: int = 16000,
        channels: int = 1,
        bytes_per_sample: int = 2
    ) -> float:
        """
        Calculate duration of audio data in seconds.

        Args:
            data_size_bytes: Size of audio data in bytes
            sample_rate: Sample rate in Hz (default 16000)
            channels: Number of audio channels (default 1 for mono)
            bytes_per_sample: Bytes per sample (2 for PCM16)

        Returns:
            Duration in seconds
        """
        num_samples = data_size_bytes / (channels * bytes_per_sample)
        duration_secs = num_samples / sample_rate
        return duration_secs

    @staticmethod
    def estimate_text_speech_duration(text: str, words_per_minute: int = 150) -> float:
        """
        Estimate how long it will take to speak text.

        Args:
            text: Text to be spoken
            words_per_minute: Average speaking speed (default 150 wpm)

        Returns:
            Estimated duration in seconds
        """
        word_count = len(text.split())
        duration_minutes = word_count / words_per_minute
        duration_seconds = duration_minutes * 60

        return duration_seconds

    @staticmethod
    def chunk_text_for_tts(
        text: str,
        max_chunk_size: int = 500
    ) -> List[str]:
        """
        Split text into chunks suitable for TTS streaming.
        Breaks on sentence boundaries when possible.

        Args:
            text: Text to split
            max_chunk_size: Maximum characters per chunk

        Returns:
            List of text chunks
        """
        # Try to split on sentences first
        import re
        sentences = re.split(r'([.!?]+\s*)', text)

        chunks = []
        current_chunk = ""

        for i in range(0, len(sentences), 2):
            sentence = sentences[i]
            punctuation = sentences[i+1] if i+1 < len(sentences) else ""
            full_sentence = sentence + punctuation

            # If adding this sentence exceeds max, save current and start new
            if len(current_chunk) + len(full_sentence) > max_chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = full_sentence
            else:
                current_chunk += full_sentence

        # Add remaining chunk
        if current_chunk:
            chunks.append(current_chunk.strip())

        return chunks

    @staticmethod
    def detect_silence(
        audio_samples: List[float],
        threshold: float = 0.02,
        min_duration_samples: int = 8000  # 0.5 sec at 16kHz
    ) -> bool:
        """
        Detect if audio contains mostly silence.

        Args:
            audio_samples: Float32 audio samples
            threshold: Amplitude threshold for silence
            min_duration_samples: Minimum samples to check

        Returns:
            True if mostly silent, False otherwise
        """
        if len(audio_samples) < min_duration_samples:
            return False

        # Check if most samples are below threshold
        silent_samples = sum(1 for s in audio_samples if abs(s) < threshold)
        silence_ratio = silent_samples / len(audio_samples)

        return silence_ratio > 0.9  # 90% silence

    @staticmethod
    def normalize_audio(audio_samples: List[float]) -> List[float]:
        """
        Normalize audio to maximize dynamic range.

        Args:
            audio_samples: Float32 audio samples

        Returns:
            Normalized audio samples
        """
        if not audio_samples:
            return audio_samples

        # Find peak amplitude
        peak = max(abs(s) for s in audio_samples)

        if peak == 0:
            return audio_samples

        # Normalize to 0.95 to avoid clipping
        target_peak = 0.95
        gain = target_peak / peak

        normalized = [s * gain for s in audio_samples]

        return normalized

    @staticmethod
    def validate_session_id(session_id: str) -> bool:
        """
        Validate session ID format.

        Args:
            session_id: Session identifier to validate

        Returns:
            True if valid, False otherwise
        """
        import re
        # Allow alphanumeric, hyphens, underscores, 8-64 chars
        pattern = r'^[a-zA-Z0-9_-]{8,64}$'
        return bool(re.match(pattern, session_id))

    @staticmethod
    def sanitize_transcript(transcript: str) -> str:
        """
        Sanitize transcribed text for safety.

        Args:
            transcript: Raw transcript from STT

        Returns:
            Sanitized transcript
        """
        # Remove excessive whitespace
        sanitized = ' '.join(transcript.split())

        # Truncate if too long (safety measure)
        max_length = 2000
        if len(sanitized) > max_length:
            sanitized = sanitized[:max_length]
            logger.warning(f"Transcript truncated from {len(transcript)} to {max_length} chars")

        return sanitized

    @staticmethod
    def format_conversation_log(
        messages: List[dict],
        include_timestamps: bool = True
    ) -> str:
        """
        Format conversation history as readable text.

        Args:
            messages: List of message dicts with role, content, timestamp
            include_timestamps: Whether to include timestamps

        Returns:
            Formatted conversation string
        """
        lines = []
        for msg in messages:
            role = msg.get('role', 'unknown').capitalize()
            content = msg.get('content', '')

            if include_timestamps and 'timestamp' in msg:
                timestamp = msg['timestamp']
                lines.append(f"[{timestamp}] {role}: {content}")
            else:
                lines.append(f"{role}: {content}")

        return '\n'.join(lines)
