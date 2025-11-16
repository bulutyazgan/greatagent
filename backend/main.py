import argparse

import requests
import uvicorn

from app import API_ENDPOINT, MODELS, app, get_api_session


def run_connection_test() -> None:
    """Replicates the previous CLI test to validate credentials."""

    print("Attempting to create API session...")

    try:
        api_client = get_api_session()
        test_data = {
            "team_id": api_client.headers.get("X-Team-ID"),
            "api_token": api_client.headers.get("X-API-Token"),
            "model": MODELS["fast"],
            "messages": [
                {"role": "user", "content": "Hello! Just testing the connection."}
            ],
            "max_tokens": 50
        }

        print("Sending test request to API...")
        response = api_client.post(API_ENDPOINT, json=test_data)
        response.raise_for_status()
        result = response.json()

        print("\n✅ API connection successful!")
        if "metadata" in result and "remaining_quota" in result["metadata"]:
            quota = result["metadata"]["remaining_quota"]
            print(f"  Budget Remaining: ${quota['remaining_budget']}")

        print("\nTest Response:")
        print(result["content"][0]["text"])
    except ValueError as config_err:
        print(f"\n❌ SETUP ERROR: {config_err}")
    except requests.exceptions.HTTPError as http_err:
        print(f"\n❌ HTTP ERROR: {http_err}")
        if http_err.response is not None:
            print(f"   Response body: {http_err.response.text}")
    except Exception as err:
        print(f"\n❌ An unexpected error occurred: {err}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Beacon FastAPI server runner")
    parser.add_argument(
        "--test-connection",
        action="store_true",
        help="Run the Bedrock connection test and exit"
    )
    parser.add_argument("--host", default="0.0.0.0", help="Host for the FastAPI server")
    parser.add_argument("--port", type=int, default=8000, help="Port for the FastAPI server")
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload (useful during development)"
    )

    args = parser.parse_args()

    if args.test_connection:
        run_connection_test()
    else:
        uvicorn.run("app:app", host=args.host, port=args.port, reload=args.reload)
