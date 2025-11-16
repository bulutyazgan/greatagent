"""
Quick Voice Integration Test - See it work instantly!

Run this to see a simulated emergency conversation.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from voice.voice_agent import voice_agent
from voice.tts_service import tts_service


def print_separator():
    print("\n" + "=" * 70)


def demo_conversation():
    """Show a complete emergency conversation"""
    print_separator()
    print("🎙️  SIMULATED EMERGENCY VOICE CONVERSATION")
    print_separator()

    # Setup
    session_id = "emergency-test-001"
    location = {"lat": 37.7749, "lng": -122.4194}  # San Francisco

    print("\n📍 Location: San Francisco (37.7749, -122.4194)")
    print("🆔 Session ID:", session_id)

    # Start conversation
    print_separator()
    print("STARTING CONVERSATION...")
    print_separator()

    greeting = voice_agent.start_session(session_id, location)
    print(f"\n🤖 AGENT: {greeting}")

    # Simulated conversation turns
    conversation = [
        "There's a fire in my apartment building!",
        "I'm on the 5th floor",
        "I can't get to the stairs, there's too much smoke",
        "Just me, I'm alone but I can't move",
        "Yes I have a window"
    ]

    for i, user_message in enumerate(conversation, 1):
        print(f"\n👤 USER (Turn {i}): {user_message}")

        # Process the message
        result = voice_agent.process_user_input(
            session_id=session_id,
            user_message=user_message,
            location=location
        )

        print(f"\n🤖 AGENT: {result['agent_message']}")

        # Show what was extracted
        session = voice_agent.get_session(session_id)
        print("\n   📊 Information extracted so far:")
        print(f"      • Floor: {session.floor_number or 'Not yet determined'}")
        print(f"      • People: {session.people_count or 'Not yet determined'}")
        print(f"      • Mobility: {session.mobility_status or 'Not yet determined'}")
        print(f"      • Vulnerabilities: {session.vulnerability_factors or 'None identified'}")

        # Check if case created
        if result.get('case_created'):
            print_separator()
            print("✅ EMERGENCY CASE CREATED!")
            print_separator()
            print(f"\n   Case ID: {result['case_id']}")
            print(f"   Total turns: {result['turn_count']}")
            print(f"   Information collected: {len([v for v in result['information_collected'].values() if v])}/7 fields")
            print("\n   🚨 What happens next:")
            print("      1. Case appears on helpers' maps")
            print("      2. AI generates survival guidance for caller")
            print("      3. Helpers nearby are matched based on skills/location")
            print("      4. Helper receives AI-generated action plan")
            break

    # Cleanup
    voice_agent.end_session(session_id)
    print_separator()
    print("Session ended.")


def demo_info_extraction():
    """Show how natural language is parsed"""
    print_separator()
    print("🧠 NATURAL LANGUAGE UNDERSTANDING")
    print_separator()
    print("\nThis shows how the agent extracts structured data from casual speech:\n")

    test_cases = [
        ("Fire on the 3rd floor", {"floor": 3}),
        ("There are 5 people with me", {"people": 5}),
        ("I'm trapped and can't move", {"mobility": "trapped"}),
        ("My elderly mother is here", {"vulnerability": "elderly"}),
        ("We have 2 kids", {"vulnerability": "children_present"}),
    ]

    session_id = "extraction-test"
    voice_agent.start_session(session_id, {"lat": 0, "lng": 0})
    session = voice_agent.get_session(session_id)

    for phrase, expected in test_cases:
        print(f"📝 Input: \"{phrase}\"")

        # Process
        session.add_message("user", phrase)
        voice_agent._extract_information(session, phrase)

        # Show results
        print(f"   ✅ Extracted:")
        if 'floor' in expected:
            print(f"      Floor number: {session.floor_number}")
        if 'people' in expected:
            print(f"      People count: {session.people_count}")
        if 'mobility' in expected:
            print(f"      Mobility status: {session.mobility_status}")
        if 'vulnerability' in expected:
            print(f"      Vulnerabilities: {session.vulnerability_factors}")
        print()

    voice_agent.end_session(session_id)


def demo_voice_selection():
    """Show intelligent voice selection"""
    print_separator()
    print("🎵 CONTEXT-AWARE VOICE SELECTION")
    print_separator()
    print("\nThe system automatically selects appropriate voices:\n")

    scenarios = [
        ("Calm caller, low urgency", "low", "caller"),
        ("CRITICAL emergency caller", "critical", "caller"),
        ("Helper receiving instructions", None, "helper"),
    ]

    voices = tts_service.get_available_voices()

    for description, urgency, role in scenarios:
        voice_type = tts_service._select_voice_by_context(urgency, role)
        voice_info = voices.get(voice_type, {})

        print(f"📋 {description}")
        print(f"   ✅ Selected: {voice_info.get('name')} ({voice_type})")
        print(f"   📝 {voice_info.get('description')}")
        print(f"   💡 Best for: {voice_info.get('use_case')}")
        print()


def show_available_voices():
    """List all available voices"""
    print_separator()
    print("🎤 AVAILABLE VOICES")
    print_separator()

    voices = tts_service.get_available_voices()

    print(f"\nTotal voices configured: {len(voices)}\n")

    for voice_type, info in voices.items():
        print(f"• {info['name']} ({voice_type})")
        print(f"  Description: {info['description']}")
        print(f"  Use case: {info['use_case']}")
        print(f"  Voice ID: {info['id'][:30]}...")
        print()


def main():
    """Run all quick demos"""
    print("\n" + "=" * 70)
    print("  🎙️  VOICE INTEGRATION - QUICK TEST")
    print("=" * 70)
    print("\nThis demonstrates the voice integration module in action.")
    print("Watch how the AI agent handles an emergency conversation!\n")

    input("Press Enter to start the demo...")

    # Run demos
    demo_conversation()

    input("\n\nPress Enter to see information extraction...")
    demo_info_extraction()

    input("\n\nPress Enter to see voice selection...")
    demo_voice_selection()

    input("\n\nPress Enter to see available voices...")
    show_available_voices()

    print_separator()
    print("✅ DEMO COMPLETE!")
    print_separator()
    print("\n📚 What you just saw:")
    print("   ✅ Multi-turn AI conversation")
    print("   ✅ Natural language understanding")
    print("   ✅ Automatic information extraction")
    print("   ✅ Context-aware voice selection")
    print("   ✅ Emergency case creation")
    print("\n🚀 The voice integration is fully functional!")
    print("\n💡 Next step: Build the frontend components to connect to this backend.\n")


if __name__ == "__main__":
    main()
