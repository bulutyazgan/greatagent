#!/usr/bin/env python3
"""
Create the beacon-demo project in LangSmith
"""
import os
from dotenv import load_dotenv
from langsmith import Client

load_dotenv()

LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY")
LANGSMITH_PROJECT = os.getenv("LANGSMITH_PROJECT", "beacon-demo")

if not LANGSMITH_API_KEY:
    print("❌ LANGSMITH_API_KEY not found in .env file")
    exit(1)

# Initialize client
ls_client = Client(api_key=LANGSMITH_API_KEY)

print(f"🔨 Creating project '{LANGSMITH_PROJECT}'...")

try:
    # Check if project already exists
    projects = list(ls_client.list_projects(limit=100))
    existing_project = next((p for p in projects if p.name == LANGSMITH_PROJECT), None)

    if existing_project:
        print(f"✅ Project '{LANGSMITH_PROJECT}' already exists!")
    else:
        # Create the project
        new_project = ls_client.create_project(
            project_name=LANGSMITH_PROJECT,
            description="BEACON Emergency Response System - AI agent observability and metrics"
        )
        print(f"✅ Successfully created project '{LANGSMITH_PROJECT}'!")
        print(f"   Project ID: {new_project.id}")

except Exception as e:
    print(f"❌ Error creating project: {e}")
