import os
import requests
from dotenv import load_dotenv

# --- 1. Load Environment Variables ---
# This securely loads secrets from your .env file
load_dotenv()

TEAM_ID = os.getenv("TEAM_ID")
API_TOKEN = os.getenv("API_TOKEN")

# --- 2. API Constants (from the guide) ---
# The main endpoint for all requests
API_ENDPOINT = "https://ctwa92wg1b.execute-api.us-east-1.amazonaws.com/prod/invoke"

# A dictionary of recommended models for easy switching
MODELS = {
    "recommended": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    "fast": "us.anthropic.claude-3-5-haiku-20241022-v1:0",
    "powerful": "us.anthropic.claude-3-opus-20240229-v1:0",
    "llama_large": "us.meta.llama3-2-90b-instruct-v1:0",
    "mistral_large": "us.mistral.pixtral-large-2502-v1:0"
}

# --- 3. Reusable API Client ---
def get_api_session() -> requests.Session:
    """
    Creates and returns a requests.Session object with
    your team's authentication headers pre-configured.
    """
    
    # Safety check
    if not TEAM_ID or not API_TOKEN:
        raise ValueError(
            "TEAM_ID or API_TOKEN not found. "
            "Please check your .env file."
        )

    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "X-Team-ID": TEAM_ID,
        "X-API-Token": API_TOKEN
    })
    return session

# --- 4. Main execution (for testing) ---
# This block only runs when you execute `python3 main.py`
# It's a great way to test that your credentials are set up correctly.
if __name__ == "__main__":
    print("Attempting to create API session...")
    
    try:
        # 1. Create the session
        api_client = get_api_session()
        
        # 2. Prepare a test request
        # --- THIS IS THE FIX ---
        # The server error says it's missing api_token in the body,
        # so we'll add it here, even though it's also in the headers.
        test_data = {
            "team_id": TEAM_ID,
            "api_token": API_TOKEN, # <-- ADDED THIS LINE
            "model": MODELS["fast"], 
            "messages": [
                {"role": "user", "content": "Hello! Just testing the connection."}
            ],
            "max_tokens": 50
        }

        # 3. Send the test request
        print("Sending test request to API...")
        response = api_client.post(API_ENDPOINT, json=test_data)
        
        # Check for HTTP errors
        response.raise_for_status()

        result = response.json()
        
        # 4. Print success message and quota
        print("\n✅ API connection successful!")
        
        if "metadata" in result and "remaining_quota" in result["metadata"]:
            quota = result["metadata"]["remaining_quota"]
            print(f"  Budget Remaining: ${quota['remaining_budget']}")
        
        print("\nTest Response:")
        print(result["content"][0]["text"])

    except ValueError as e:
        print(f"\n❌ SETUP ERROR: {e}")
    except requests.exceptions.HTTPError as e:
        # --- THIS IS THE FIX ---
        # The error object 'e' *is* the error, it doesn't have an '.Error' attribute
        print(f"\n❌ HTTP ERROR: {e}") 
        print(f"   Response body: {e.response.text}")
    except Exception as e:
        print(f"\n❌ An unexpected error occurred: {e}")