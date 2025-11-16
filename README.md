
# Beacon / Beaconn — Emergency Response Coordination System

Beacon (beaconn) is an AI-powered emergency response coordination platform developed during the Great Agent Hack at UCL. It combines LangGraph-style agent orchestration, LangChain tooling, and modern web technologies to coordinate helpers and people in need during large-scale disasters.

This README provides a current, high-level summary of the repository, how to get started, and where to find detailed implementation and integration documentation contained in the repo.

Status
- Active prototype with agent orchestration, backend APIs, and a React frontend.
- Rich documentation present in the repo (implementation notes, LangSmith examples, integration plans, quickstarts).
- Integrations & telemetry: LangSmith integrations and Bedrock/LLM multi-model support are documented and used by the system.

Repository layout (high level)
- README.md — (this file)
- QUICKSTART.md — concise setup and run instructions
- FRONTEND_BACKEND_INTEGRATION_PLAN.md — detailed frontend/backend contract and integration notes
- IMPLEMENTATION_SUMMARY.md — in-depth design and implementation details
- LANGSMITH_*.md — LangSmith integration notes, quickstart and examples
- TRACK_A_IMPLEMENTATION_CHECKLIST.md — large checklist / roadmap for Track A / demo readiness
- backend/ — Python backend (agents, API, database helpers)
  - database/ — DB schema, docker-compose for Postgres + PostGIS, example SQL
  - agent_graph.py, agent_state.py, agent_tools.py, main.py, etc.
- frontend/ — React + TypeScript frontend
- tutorials/ — examples and tutorial material
- beaconn-Photoroom.png — project image / logo

Key capabilities (up to date)
- Agent-based coordination
  - LangGraph-style orchestration of multiple specialized agents implemented in the backend.
  - Modular agents for coordination, matching, database access, and communications.
- Multi-model LLM support
  - Designed to support AWS Bedrock and multiple LLMs (Claude family, Llama, Mistral, etc.).
  - LangSmith integration for logging, evaluation, and traceability (see LANGSMITH_INTEGRATION.md and LANGSMITH_CODE_EXAMPLES.md).
- Spatial matching & database
  - PostgreSQL + PostGIS for location storage and proximity queries (helper-search, nearest resources).
  - Database schema and example data in backend/database (init.sql and docker-compose).
- Real-time/near-real-time assignment logic
  - Matching Agent pairs helpers and cases based on skills, availability, and proximity.
  - Assignment tracking, case lifecycle transitions (open → in_progress → resolved → closed).
- Audit trail & telemetry
  - Actions and agent decisions are logged for auditing, with integrations to LangSmith for richer traces.
- Frontend
  - React + TypeScript UI that interacts with the backend APIs (see FRONTEND_BACKEND_INTEGRATION_PLAN.md for endpoints and data contracts).
- Developer-focused documentation
  - Multiple design & implementation docs to help contributors onboard quickly:
    - IMPLEMENTATION_SUMMARY.md
    - QUICKSTART.md
    - LANGSMITH_QUICKSTART.md
    - FRONTEND_BACKEND_INTEGRATION_PLAN.md

Notable design elements
- 3-layer emergency model:
  - Emergencies: top-level events covering geographic areas (e.g., city wildfires).
  - Case Groups: logical clusters within an emergency (e.g., buildings, evacuation routes).
  - Cases: individual help requests.
- Helpers and callers:
  - Helpers have skill tags, maximum travel ranges, and location data (PostGIS POINT).
  - Callers can submit anonymous help requests; privacy-preserving options are considered.
- Extensible toolset:
  - Agent tools are modular and designed to be extended for new notification channels, external APIs, or alternate LLM providers.

Quick links (in-repo docs)
- QUICKSTART.md — quick setup & run instructions
- IMPLEMENTATION_SUMMARY.md — architecture and implementation notes
- FRONTEND_BACKEND_INTEGRATION_PLAN.md — API & integration plan
- LANGSMITH_QUICKSTART.md — how to set up LangSmith logging/telemetry
- LANGSMITH_CODE_EXAMPLES.md — code examples for LangSmith usage
- TRACK_A_IMPLEMENTATION_CHECKLIST.md — demo and release checklist

Getting started (short)
1. Clone repository
   - git clone https://github.com/bulutyazgan/beaconn.git
2. Database
   - cd backend/database
   - docker-compose up -d
   - This brings up PostgreSQL with PostGIS; sample schema and seed data are available in init.sql.
3. Backend
   - cd ../.. # to repo root or backend
   - Create a .env in backend/ (see QUICKSTART.md and LANGSMITH_QUICKSTART.md). Typical variables:
     - TEAM_ID=
     - API_TOKEN= (if using any external APIs)
     - DATABASE_URL=postgresql://beacon_user:beacon_local_dev@localhost:5432/beacon
     - LANGSMITH_API_KEY= (optional, for telemetry)
     - BEDROCK_API_KEY / PROVIDER_... (if using Bedrock)
   - Install Python deps: pip install -r requirements.txt
   - Run agent system or API entry point (see backend/README or QUICKSTART):
     - python main.py
     - or python agent_graph.py
4. Frontend
   - cd frontend
   - npm install
   - npm run dev
   - Default dev server: http://localhost:5173 (see FRONTEND_BACKEND_INTEGRATION_PLAN.md for API base URL)
5. Tests & tooling
   - Many docs include code snippets and test scaffolding; consult QUICKSTART.md and LANGSMITH_* files for running examples and telemetry.

Configuration & environment
- Sensitive keys and credentials should always be set in environment variables or a secrets manager; the repo includes guidance in LANGSMITH_QUICKSTART.md and QUICKSTART.md.
- When using Bedrock or other hosted LLM providers, verify quotas and credentials before running large experiments.

Where to look next
- IMPLEMENTATION_SUMMARY.md — read this for deep-dive implementation and rationale.
- FRONTEND_BACKEND_INTEGRATION_PLAN.md — use this while wiring frontend to backend endpoints.
- LANGSMITH_INTEGRATION.md and LANGSMITH_CODE_EXAMPLES.md — how telemetry and traces are captured for agent runs.
- TRACK_A_IMPLEMENTATION_CHECKLIST.md — roadmap for turning the prototype into a demo-ready system.

Contributing
- The repository contains many design notes and a checklist for Track A. If you want to contribute:
  - Open an issue to propose changes or request a task.
  - Follow the documented integration plans and implementation summary when adding features or modifying agent behavior.
  - Consider preserving or extending LangSmith traces for any agent changes.

License & attribution
- Built for the Great Agent Hack at UCL. See repo headers and individual files for any license notes or contributor attributions.

Contact / Authors
- See commit history and contributors on GitHub for author details and contact.

If you want, I can:
- Produce a more compact README focused only on setup scripts.
- Open a PR that replaces the current README.md with this updated content.
- Extract and merge key snippets from IMPLEMENTATION_SUMMARY.md and QUICKSTART.md into this file for an even more comprehensive single-file doc.

