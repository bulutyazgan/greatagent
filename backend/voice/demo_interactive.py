"""
Interactive Voice Agent Demo

Run this to test the voice agent in your terminal!
You'll simulate a caller having a conversation with the AI agent.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from voice.voice_agent import voice_agent
from voice.audio_utils import AudioUtils


def print_header(text):
    """Print a nice header"""
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60)


def print_agent(message):
    """Print agent message in blue"""
    print(f"\n🤖 AGENT: {message}")


def print_user(message):
    """Print user message in green"""
    print(f"\n👤 YOU: {message}")


def print_info(key, value):
    """Print extracted information"""
    print(f"   📊 {key}: {value}")


def run_interactive_demo():
    """Run an interactive conversation demo"""
    print_header("🎙️  Voice Agent Interactive Demo")
    print("\nThis simulates a voice conversation between you (the caller)")
    print("and the AI emergency agent.")
    print("\nType your responses as if you were speaking to the agent.")
    print("Type 'quit' to exit.\n")

    # Start session
    session_id = "demo-session-001"
    location = {"lat": 37.7749, "lng": -122.4194}

    print("Starting voice session...")
    greeting = voice_agent.start_session(session_id, location)
    print_agent(greeting)

    # Conversation loop
    turn_count = 0
    max_turns = 10

    while turn_count < max_turns:
        # Get user input
        user_input = input("\n👤 YOU: ").strip()

        if not user_input:
            print("   (Please say something...)")
            continue

        if user_input.lower() in ['quit', 'exit', 'bye']:
            print("\nEnding conversation...")
            break

        # Process user input
        try:
            result = voice_agent.process_user_input(
                session_id=session_id,
                user_message=user_input,
                location=location
            )

            # Show agent response
            print_agent(result['agent_message'])

            # Show extracted information
            info = result['information_collected']
            if any(info.values()):
                print("\n   📋 Information Collected:")
                if info.get('description'):
                    print_info("Description", info['description'][:50] + "...")
                if info.get('floor_number'):
                    print_info("Floor", info['floor_number'])
                if info.get('people_count'):
                    print_info("People", info['people_count'])
                if info.get('mobility_status'):
                    print_info("Mobility", info['mobility_status'])
                if info.get('vulnerability_factors'):
                    print_info("Vulnerabilities", ", ".join(info['vulnerability_factors']))

            # Check if case was created
            if result['case_created']:
                print_header("✅ Emergency Case Created!")
                print(f"\n   Case ID: {result['case_id']}")
                print(f"   Total conversation turns: {result['turn_count']}")
                print("\n   The caller would now receive AI-generated survival guidance.")
                print("   Helpers would see this case on their map.\n")
                break

            turn_count += 1

        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()
            break

    # Cleanup
    voice_agent.end_session(session_id)
    print("\n✅ Session ended.\n")


def run_automated_demo():
    """Run a pre-scripted conversation demo"""
    print_header("🎬 Automated Conversation Demo")
    print("\nThis shows a complete conversation flow automatically.\n")

    session_id = "demo-session-002"
    location = {"lat": 34.0522, "lng": -118.2437}

    # Conversation script
    conversation = [
        ("There's a fire in my apartment building", False),
        ("I'm on the 5th floor", False),
        ("I can't reach the stairs, there's too much smoke", False),
        ("Just me, I'm alone", False),
        ("Yes, I have a window I can open", True),
    ]

    # Start session
    greeting = voice_agent.start_session(session_id, location)
    print_agent(greeting)
    input("\n   [Press Enter to continue...]")

    # Run conversation
    for user_message, is_last in conversation:
        print_user(user_message)
        input("\n   [Press Enter to continue...]")

        result = voice_agent.process_user_input(
            session_id=session_id,
            user_message=user_message,
            location=location
        )

        print_agent(result['agent_message'])

        # Show what was extracted
        session = voice_agent.get_session(session_id)
        print(f"\n   📊 Extracted so far:")
        print(f"      Floor: {session.floor_number or 'Unknown'}")
        print(f"      People: {session.people_count or 'Unknown'}")
        print(f"      Mobility: {session.mobility_status or 'Unknown'}")

        if result['case_created']:
            print_header("✅ Case Created Successfully!")
            print(f"\n   Case ID: {result['case_id']}")
            break

        if not is_last:
            input("\n   [Press Enter to continue...]")

    voice_agent.end_session(session_id)
    print("\n✅ Demo complete!\n")


def show_session_analysis():
    """Analyze a conversation session"""
    print_header("📊 Session Analysis Demo")
    print("\nThis shows how the agent extracts information from natural language.\n")

    session_id = "demo-session-003"
    location = {"lat": 40.7128, "lng": -74.0060}

    # Start session
    voice_agent.start_session(session_id, location)

    # Test different phrases
    test_phrases = [
        "Fire on the 3rd floor",
        "There are 5 people trapped with me",
        "My elderly mother is here and she can't walk",
        "We're in apartment 302",
    ]

    for phrase in test_phrases:
        print_user(phrase)

        # Add message and extract info
        session = voice_agent.get_session(session_id)
        session.add_message("user", phrase)
        voice_agent._extract_information(session, phrase)

        # Show what was extracted
        print("   Extracted:")
        if session.floor_number:
            print(f"      ✅ Floor number: {session.floor_number}")
        if session.people_count:
            print(f"      ✅ People count: {session.people_count}")
        if session.mobility_status:
            print(f"      ✅ Mobility: {session.mobility_status}")
        if session.vulnerability_factors:
            print(f"      ✅ Vulnerabilities: {', '.join(session.vulnerability_factors)}")

        input("\n   [Press Enter for next phrase...]")

    # Final state
    session = voice_agent.get_session(session_id)
    print("\n   📋 Final Session State:")
    print(f"      Floor: {session.floor_number}")
    print(f"      People: {session.people_count}")
    print(f"      Mobility: {session.mobility_status}")
    print(f"      Vulnerabilities: {session.vulnerability_factors}")
    print(f"      Ready for case creation: {session.is_ready_for_case_creation()}")

    voice_agent.end_session(session_id)
    print("\n✅ Analysis complete!\n")


def test_voice_selection():
    """Demo the context-aware voice selection"""
    print_header("🎵 Voice Selection Demo")
    print("\nThis shows how the system selects appropriate voices.\n")

    from voice.tts_service import tts_service

    scenarios = [
        {
            "description": "Calm situation, victim calling",
            "urgency": "low",
            "role": "caller",
        },
        {
            "description": "Critical emergency, victim calling",
            "urgency": "critical",
            "role": "caller",
        },
        {
            "description": "Helper receiving instructions",
            "urgency": None,
            "role": "helper",
        },
        {
            "description": "High urgency, helper responding",
            "urgency": "high",
            "role": "helper",
        },
    ]

    voices = tts_service.get_available_voices()

    for scenario in scenarios:
        print(f"\n📋 Scenario: {scenario['description']}")
        print(f"   Urgency: {scenario['urgency'] or 'normal'}")
        print(f"   Role: {scenario['role']}")

        voice_type = tts_service._select_voice_by_context(
            scenario['urgency'],
            scenario['role']
        )

        voice_info = voices.get(voice_type, {})
        print(f"\n   ✅ Selected Voice: {voice_type}")
        print(f"      Name: {voice_info.get('name', 'Unknown')}")
        print(f"      Description: {voice_info.get('description', 'N/A')}")
        print(f"      Use case: {voice_info.get('use_case', 'N/A')}")

        input("\n   [Press Enter for next scenario...]")

    print("\n✅ Voice selection demo complete!\n")


def main():
    """Main menu"""
    while True:
        print_header("🎙️  Voice Integration Demo Menu")
        print("\nChoose a demo to run:\n")
        print("  1. Interactive Conversation (you type responses)")
        print("  2. Automated Conversation (watch it run)")
        print("  3. Information Extraction Analysis")
        print("  4. Voice Selection Demo")
        print("  5. Exit")

        choice = input("\nEnter choice (1-5): ").strip()

        if choice == "1":
            run_interactive_demo()
        elif choice == "2":
            run_automated_demo()
        elif choice == "3":
            show_session_analysis()
        elif choice == "4":
            test_voice_selection()
        elif choice == "5":
            print("\nGoodbye! 👋\n")
            break
        else:
            print("\n❌ Invalid choice. Please enter 1-5.\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Interrupted by user. Goodbye!\n")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
