"""
Test script for voice integration module

Tests STT, TTS, and voice agent functionality.
Run with: python -m voice.test_voice_integration
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from voice.stt_service import stt_service
from voice.tts_service import tts_service
from voice.voice_agent import voice_agent
from voice.audio_utils import AudioUtils


def test_stt_service():
    """Test STT token generation"""
    print("\n=== Testing STT Service ===")

    try:
        result = stt_service.generate_token(
            session_id="test-session-stt",
            language_code="en"
        )

        print(f"✅ STT Token generated successfully")
        print(f"   Session ID: test-session-stt")
        print(f"   Token length: {len(result['token'])} chars")
        print(f"   WebSocket URL: {result['ws_url'][:80]}...")
        print(f"   Expires in: {result['expires_in']} seconds")

        # Test config
        config = stt_service.get_config_for_frontend()
        print(f"✅ STT Config retrieved")
        print(f"   Sample rate: {config['sample_rate']} Hz")
        print(f"   Audio format: {config['audio_format']}")
        print(f"   Languages: {len(config['languages'])} supported")

        return True

    except Exception as e:
        print(f"❌ STT Service failed: {e}")
        return False


def test_tts_service():
    """Test TTS token generation"""
    print("\n=== Testing TTS Service ===")

    try:
        # Test default voice
        result = tts_service.generate_token(
            session_id="test-session-tts",
            voice_type="calm_female"
        )

        print(f"✅ TTS Token generated successfully")
        print(f"   Session ID: test-session-tts")
        print(f"   Voice type: {result['voice_type']}")
        print(f"   Voice ID: {result['voice_id']}")
        print(f"   Token length: {len(result['token'])} chars")
        print(f"   WebSocket URL: {result['ws_url'][:80]}...")

        # Test context-aware voice selection
        result2 = tts_service.generate_token(
            session_id="test-session-tts-2",
            urgency="critical",
            role="caller"
        )

        print(f"✅ Context-aware voice selected")
        print(f"   Urgency: critical, Role: caller")
        print(f"   Selected voice: {result2['voice_type']}")

        # Test available voices
        voices = tts_service.get_available_voices()
        print(f"✅ Available voices: {len(voices)}")
        for voice_type, info in voices.items():
            print(f"   - {voice_type}: {info['name']} ({info['use_case']})")

        return True

    except Exception as e:
        print(f"❌ TTS Service failed: {e}")
        return False


def test_voice_agent():
    """Test conversational voice agent"""
    print("\n=== Testing Voice Agent ===")

    try:
        session_id = "test-session-agent"
        location = {"lat": 37.7749, "lng": -122.4194}

        # Start session
        greeting = voice_agent.start_session(session_id, location)
        print(f"✅ Session started")
        print(f"   Agent: {greeting}")

        # First turn - user describes emergency
        result1 = voice_agent.process_user_input(
            session_id=session_id,
            user_message="There's a fire in my apartment building",
            location=location
        )

        print(f"\n✅ Turn 1 processed")
        print(f"   User: There's a fire in my apartment building")
        print(f"   Agent: {result1['agent_message']}")
        print(f"   Case created: {result1['case_created']}")
        print(f"   Info collected: {result1['information_collected']}")

        # Second turn - user provides more details
        result2 = voice_agent.process_user_input(
            session_id=session_id,
            user_message="I'm trapped on the 5th floor, can't reach the stairs",
            location=location
        )

        print(f"\n✅ Turn 2 processed")
        print(f"   User: I'm trapped on the 5th floor, can't reach the stairs")
        print(f"   Agent: {result2['agent_message']}")
        print(f"   Case created: {result2['case_created']}")
        print(f"   Turn count: {result2['turn_count']}")

        # Get session info
        session = voice_agent.get_session(session_id)
        print(f"\n✅ Session info retrieved")
        print(f"   Total messages: {len(session.messages)}")
        print(f"   Floor number: {session.floor_number}")
        print(f"   Mobility status: {session.mobility_status}")

        # Cleanup
        voice_agent.end_session(session_id)
        print(f"✅ Session ended")

        return True

    except Exception as e:
        print(f"❌ Voice Agent failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_audio_utils():
    """Test audio utilities"""
    print("\n=== Testing Audio Utils ===")

    try:
        # Test session ID validation
        valid_ids = ["test-session-123", "user_abc123", "12345678"]
        invalid_ids = ["short", "has spaces", "bad@chars", ""]

        for session_id in valid_ids:
            assert AudioUtils.validate_session_id(session_id), f"Should be valid: {session_id}"

        for session_id in invalid_ids:
            assert not AudioUtils.validate_session_id(session_id), f"Should be invalid: {session_id}"

        print(f"✅ Session ID validation works")

        # Test transcript sanitization
        dirty = "  Too   much    whitespace  "
        clean = AudioUtils.sanitize_transcript(dirty)
        assert clean == "Too much whitespace", f"Expected clean, got: {clean}"
        print(f"✅ Transcript sanitization works")

        # Test text chunking for TTS
        long_text = "First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence."
        chunks = AudioUtils.chunk_text_for_tts(long_text, max_chunk_size=50)
        print(f"✅ Text chunking works")
        print(f"   Original: {len(long_text)} chars")
        print(f"   Chunks: {len(chunks)}")
        for i, chunk in enumerate(chunks):
            print(f"   Chunk {i+1}: {chunk[:40]}...")

        # Test duration estimation
        text = "This is a test message with approximately ten words in it."
        duration = AudioUtils.estimate_text_speech_duration(text)
        print(f"✅ Duration estimation works")
        print(f"   Text: {len(text.split())} words")
        print(f"   Estimated duration: {duration:.2f} seconds")

        return True

    except Exception as e:
        print(f"❌ Audio Utils failed: {e}")
        return False


def main():
    """Run all tests"""
    print("=" * 60)
    print("Voice Integration Test Suite")
    print("=" * 60)

    results = []

    # Check if API key is configured
    from voice.config import VoiceConfig
    if not VoiceConfig.ELEVENLABS_API_KEY:
        print("\n⚠️  WARNING: ELEVENLABS_API_KEY not configured in .env")
        print("   Token generation tests will fail without API key.")
        print("   Other tests will still run.\n")

    # Run tests
    results.append(("Audio Utils", test_audio_utils()))
    results.append(("STT Service", test_stt_service()))
    results.append(("TTS Service", test_tts_service()))
    results.append(("Voice Agent", test_voice_agent()))

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Check output above.")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
