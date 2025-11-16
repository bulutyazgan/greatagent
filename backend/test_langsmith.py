#!/usr/bin/env python3
"""
Test LangSmith connection and list available projects
"""
import os
from dotenv import load_dotenv
from langsmith import Client

load_dotenv()

LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY")

if not LANGSMITH_API_KEY:
    print("❌ LANGSMITH_API_KEY not found in .env file")
    exit(1)

print(f"✅ Found LANGSMITH_API_KEY: {LANGSMITH_API_KEY[:20]}...")

# Initialize client
ls_client = Client(api_key=LANGSMITH_API_KEY)

print("\n📋 Listing available projects:")
try:
    # List all projects
    projects = list(ls_client.list_projects(limit=10))

    if not projects:
        print("   No projects found. You need to create a project first.")
        print("\n💡 To create a project:")
        print("   1. Go to https://smith.langchain.com")
        print("   2. Create a new project called 'beacon-demo'")
        print("   3. OR create any project and update .env LANGSMITH_PROJECT variable")
    else:
        print(f"   Found {len(projects)} project(s):\n")
        for project in projects:
            print(f"   • {project.name}")

except Exception as e:
    print(f"❌ Error listing projects: {e}")
