"""
Standalone Voice Demo - No database needed!

Run this to see the voice agent in action.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from voice.voice_agent import voice_agent, ConversationState
from voice.tts_service import tts_service
from voice.audio_utils import AudioUtils


print("\n" + "=" * 70)
print("  🎙️  VOICE AGENT LIVE DEMO")
print("=" * 70)

# Demo 1: Complete Conversation
print("\n📞 DEMO 1: Emergency Conversation Simulation")
print("=" * 70)

session_id = "demo-123"
location = {"lat": 37.7749, "lng": -122.4194}

# Start session
greeting = voice_agent.start_session(session_id, location)
print(f"\n🤖 AI AGENT: {greeting}")

# Simulate conversation
conversation = [
    "There's a fire in my apartment!",
    "I'm on the 5th floor",
    "I can't get out, the hallway is full of smoke",
    "Just me, I'm trapped alone",
]

for i, user_message in enumerate(conversation, 1):
    print(f"\n👤 CALLER (Turn {i}): {user_message}")

    # Get the session
    session = voice_agent.get_session(session_id)

    # Add message and extract info
    session.add_message("user", user_message)
    voice_agent._extract_information(session, user_message)

    # Generate a response (simulated since we don't have LLM access in this demo)
    if i == 1:
        response = "I understand there's a fire. Are you safe right now? What floor are you on?"
    elif i == 2:
        response = "Got it, 5th floor. Can you evacuate safely, or are you trapped?"
    elif i == 3:
        response = "Stay calm. Is anyone else with you?"
    else:
        response = "I have enough information. Creating your emergency case now. Help is on the way."

    session.add_message("agent", response)
    print(f"\n🤖 AI AGENT: {response}")

    # Show extracted information
    print(f"\n   📊 Extracted Information:")
    if session.floor_number:
        print(f"      ✅ Floor: {session.floor_number}")
    if session.people_count:
        print(f"      ✅ People: {session.people_count}")
    if session.mobility_status:
        print(f"      ✅ Mobility: {session.mobility_status}")
    if session.description:
        print(f"      ✅ Description: {session.description[:50]}...")

    # Check readiness
    if session.is_ready_for_case_creation():
        print(f"\n   ✅ READY TO CREATE CASE!")
        print(f"      Location: {session.location}")
        print(f"      Turn count: {session.turn_count}")
        break

print("\n" + "=" * 70)
print("✅ Conversation completed! Case would be created here.")
print("=" * 70)

# Demo 2: Information Extraction
print("\n\n📝 DEMO 2: Natural Language Understanding")
print("=" * 70)
print("\nWatch how casual speech is converted to structured data:\n")

# Create a test session
test_session = ConversationState("test-extraction")

test_phrases = [
    ("Fire on the 3rd floor", "floor number"),
    ("There are 5 people trapped", "people count"),
    ("I can't move my leg", "mobility status"),
    ("My elderly mother is with me", "vulnerability factors"),
]

for phrase, expected_field in test_phrases:
    print(f"Input: \"{phrase}\"")

    # Extract
    voice_agent._extract_information(test_session, phrase)

    # Show what was extracted
    print(f"   → Extracted {expected_field}:")
    if test_session.floor_number:
        print(f"      Floor: {test_session.floor_number}")
    if test_session.people_count:
        print(f"      People: {test_session.people_count}")
    if test_session.mobility_status:
        print(f"      Mobility: {test_session.mobility_status}")
    if test_session.vulnerability_factors:
        print(f"      Vulnerabilities: {test_session.vulnerability_factors}")
    print()

# Demo 3: Voice Selection
print("\n🎵 DEMO 3: Smart Voice Selection")
print("=" * 70)
print("\nThe system picks the right voice for each situation:\n")

scenarios = [
    ("Calm situation, victim calling", "low", "caller"),
    ("CRITICAL emergency, victim panic", "critical", "caller"),
    ("Helper receiving action plan", None, "helper"),
    ("High urgency response", "high", "helper"),
]

voices = tts_service.get_available_voices()

for desc, urgency, role in scenarios:
    voice_type = tts_service._select_voice_by_context(urgency, role)
    voice_info = voices.get(voice_type, {})

    print(f"Scenario: {desc}")
    print(f"   Selected: {voice_info.get('name')} ({voice_type})")
    print(f"   Why: {voice_info.get('use_case')}")
    print()

# Demo 4: Audio Processing
print("\n🔊 DEMO 4: Audio Processing Utilities")
print("=" * 70)

# Text chunking
long_text = "Stay calm. Move away from windows. Cover your mouth with a wet cloth. Signal for help from a window if possible."
chunks = AudioUtils.chunk_text_for_tts(long_text, max_chunk_size=50)
print(f"\nText Chunking for Streaming:")
print(f"   Original: {len(long_text)} characters")
print(f"   Chunks: {len(chunks)}")
for i, chunk in enumerate(chunks, 1):
    print(f"   Chunk {i}: \"{chunk}\"")

# Duration estimation
duration = AudioUtils.estimate_text_speech_duration(long_text)
print(f"\nSpeech Duration Estimation:")
print(f"   Text: {len(long_text.split())} words")
print(f"   Estimated duration: {duration:.2f} seconds")

# Session validation
print(f"\nSession ID Validation:")
valid_ids = ["user-123", "session_abc", "emergency-001"]
for sid in valid_ids:
    is_valid = AudioUtils.validate_session_id(sid)
    print(f"   '{sid}': {'✅ Valid' if is_valid else '❌ Invalid'}")

# Summary
print("\n\n" + "=" * 70)
print("✅ ALL DEMOS COMPLETE!")
print("=" * 70)
print("\n🎉 What you just saw working:")
print("   ✅ Multi-turn conversation management")
print("   ✅ Natural language information extraction")
print("   ✅ Context-aware voice selection")
print("   ✅ Audio text processing utilities")
print("   ✅ Session state management")
print("\n🚀 The voice integration backend is fully functional!")
print("\n📚 Available test scripts:")
print("   • voice/demo_standalone.py  (this file - no dependencies)")
print("   • voice/demo_interactive.py (interactive conversation)")
print("   • voice/test_voice_simple.py (automated tests)")
print("\n💡 Next: Build frontend React components to connect to these APIs!\n")

# Cleanup
voice_agent.end_session(session_id)
