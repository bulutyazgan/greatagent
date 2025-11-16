
# Beacon / Beaconn — Emergency Response Coordination System

Beacon (beaconn) is an AI-powered emergency response coordination platform developed during the Great Agent Hack at UCL. It combines LangGraph-style agent orchestration, LangChain tooling, and modern backend + frontend components to prototype rapid, localised assistance matching between callers and volunteer helpers.

This README is an updated, practical entrypoint: project overview, required files (including references to .env.example), setup instructions, how to run, and how to run basic tests.

Quick links (in-repo docs)
- QUICKSTART.md — quick setup & run instructions
- IMPLEMENTATION_SUMMARY.md — architecture and implementation notes
- FRONTEND_BACKEND_INTEGRATION_PLAN.md — API & integration plan
- LANGSMITH_QUICKSTART.md — how to set up LangSmith logging/telemetry
- LANGSMITH_CODE_EXAMPLES.md — code examples for LangSmith usage
- TRACK_A_IMPLEMENTATION_CHECKLIST.md — demo and release checklist

Project overview
- Purpose: enable quick matching of help requests ("cases") to nearby volunteers ("helpers") with LLM-based guidance and audit trails.
- Architecture:
  - backend/ — FastAPI + service layer, agent orchestration, DB helpers
  - frontend/ — React + TypeScript UI (dev server + production build)
  - backend/database/ — Postgres + PostGIS docker-compose and SQL init scripts
  - agents use multi-model LLM support (Bedrock / other providers) and LangSmith for telemetry (optional)
- Key capabilities: agent orchestration, spatial matching (PostGIS), assignment lifecycle, caller/helper guidance generation, telemetry.

Important env example files (please configure before running)
- backend/.env.example — located at backend/.env.example
  - Copy to backend/.env and edit before starting backend:
    - cp backend/.env.example backend/.env
  - Typical variables included or expected:
    - TEAM_ID=
    - API_TOKEN=
    - DATABASE_URL=postgresql://beacon_user:beacon_local_dev@localhost:5432/beacon
    - LANGSMITH_API_KEY=
    - BEDROCK_API_KEY=
    - PROVIDER_... (other provider-specific vars)
- frontend/.env.example — located at frontend/.env.example
  - Copy to frontend/.env and edit before starting frontend:
    - cp frontend/.env.example frontend/.env
  - Typical variables:
    - VITE_API_BASE_URL=http://localhost:8000/api
    - VITE_MAP_API_KEY= (if using map/routing services)

Requirements
- Docker & docker-compose (for running Postgres + PostGIS)
- Python 3.10+ (or as specified by backend/requirements.txt)
- Node.js 16+ / npm or yarn for frontend
- Optional: account/keys for Bedrock / LangSmith / other LLM providers

Setup (development)
1. Clone repo
   - git clone https://github.com/bulutyazgan/beaconn.git
   - cd beaconn

2. Database (Postgres + PostGIS)
   - cd backend/database
   - docker-compose up -d
   - Initialize DB schema & seed data:
     - psql -h localhost -U beacon_user -d beacon -f init.sql
   - Apply guides migration (if present):
     - psql -h localhost -U beacon_user -d beacon -f migrations/001_add_guides_tables.sql

3. Backend environment
   - Copy example env and edit:
     - cp backend/.env.example backend/.env
     - Edit backend/.env to set DATABASE_URL and any provider keys (LANGSMITH_API_KEY, BEDROCK_API_KEY, TEAM_ID, etc.)
   - Install Python dependencies:
     - cd backend
     - python -m venv .venv && source .venv/bin/activate
     - pip install -r requirements.txt
   - Start backend (dev):
     - # Option A: run via uvicorn (recommended for FastAPI)
       - uvicorn app:app --reload --host 0.0.0.0 --port 8000
     - # Option B: legacy entrypoints
       - python main.py
       - or python agent_graph.py (for agent-only runs)
   - API will be available at: http://localhost:8000
   - Open docs: http://localhost:8000/docs

4. Frontend environment
   - Copy example env and edit:
     - cp frontend/.env.example frontend/.env
     - Edit VITE_API_BASE_URL and any map/API keys
   - Install and run:
     - cd frontend
     - npm install
     - npm run dev
   - Default dev server: http://localhost:5173

How to run (end-to-end dev)
1. Ensure Postgres container is up and DB initialized (see Database step).
2. Start backend as above.
3. Start frontend as above.
4. Use the frontend to create users/cases or exercise APIs directly with curl/Postman.

Basic API smoke tests (curl examples)
- Create user with location (caller)
  curl -X POST http://localhost:8000/api/users/location-consent \
    -H "Content-Type: application/json" \
    -d '{"latitude":37.7749,"longitude":-122.4194,"name":"Test User","is_helper":false}'

- Create case (caller)
  curl -X POST http://localhost:8000/api/cases \
    -H "Content-Type: application/json" \
    -d '{"user_id":"<USER_ID>","latitude":37.7749,"longitude":-122.4194,"raw_problem_description":"Trapped in collapsed building"}'

- Find nearby cases (helper)
  curl "http://localhost:8000/api/cases/nearby?lat=37.7750&lon=-122.4195&radius=10"

- Claim assignment (helper)
  curl -X POST http://localhost:8000/api/assignments \
    -H "Content-Type: application/json" \
    -d '{"case_id":1,"helper_user_id":456}'

Notes about agent processing & guides
- Case creation triggers background agent processing (fire-and-forget in current prototype). Guides (caller/helper) may take a few seconds to appear. Poll endpoints:
  - GET /api/cases/{case_id}/caller-guide
  - GET /api/assignments/{id}/helper-guide

Running automated (or manual) tests
- There is no central test suite included in the repo root; check backend/tests or frontend/tests if present.
- Manual end-to-end testing can be done with the curl examples above after starting backend and frontend.
- To run any Python tests (if shipped):
  - cd backend
  - pytest -q
- To run any frontend tests (if shipped):
  - cd frontend
  - npm test

Configuration & secrets
- Never commit real secrets. Use .env and/or a secrets manager.
- When running LLMs (Bedrock, Anthropic, etc.) check quotas and costs before experiments.
- LANGSMITH_API_KEY is optional but recommended for traceability during development.

Troubleshooting / common issues
- DB connection errors:
  - Confirm DATABASE_URL in backend/.env points to running Postgres container and credentials match docker-compose.
- Agent errors:
  - Check backend logs; some agent pipelines use external LLMs and will fail if keys are missing.
- Frontend CORS:
  - Ensure backend allows the frontend origin or run both on localhost with default ports.

Where to look next (developer docs)
- IMPLEMENTATION_SUMMARY.md — detailed backend & agent notes
- FRONTEND_BACKEND_INTEGRATION_PLAN.md — endpoint contracts and expected payloads
- LANGSMITH_QUICKSTART.md & LANGSMITH_CODE_EXAMPLES.md — telemetry integration notes
- QUICKSTART.md — condensed runnable quickstart that mirrors these steps

Contributing
- Open an issue to propose changes or request a task.
- Follow the documented integration plans and implementation summary when adding features or modifying agent behavior.
- Preserve or extend LangSmith traces for any agent changes.

License & attribution
- Built for the Great Agent Hack at UCL. See repo headers and individual files for license notes or contributor attributions.

Contact / Authors
- See commit history and contributors on GitHub for author details and contact.

If you'd like, I can:
- Open a PR that replaces the repository README.md with this updated README and include .env.example checks in CI.
- Produce a very short README focused only on quickstart scripts.
- Extract and merge key snippets from IMPLEMENTATION_SUMMARY.md and QUICKSTART.md into a single comprehensive quickstart.
