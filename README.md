# Beacon - Emergency Response Coordination System

An AI-powered emergency response coordination platform that connects helpers with people in distress during large-scale disasters. Built for the Great Agent Hack at UCL.

## Overview

Beacon is a full-stack emergency response system that uses AI agents to coordinate disaster relief efforts. The system manages a 3-layer hierarchy of emergencies, case groups, and individual cases, intelligently matching helpers with people who need assistance based on location, skills, and availability.

### Key Features

- **AI-Powered Coordination**: LangGraph-based agent system for intelligent case routing and helper assignment
- **Multi-Model Support**: Integrates Claude 3.5 Sonnet, Haiku, and other LLMs via AWS Bedrock
- **3-Layer Emergency Hierarchy**:
  - Layer 1: City-wide emergencies (wildfires, earthquakes)
  - Layer 2: Case groups (building clusters, evacuation routes)
  - Layer 3: Individual cases (help requests)
- **Real-time Location Tracking**: PostGIS-powered spatial database for proximity matching
- **Anonymous Reporting**: Support for anonymous help requests
- **Audit Trail**: Complete activity logging for accountability

## Project Structure

```
greatagent/
├── backend/              # Python backend with LangGraph agents
│   ├── main.py          # API client and credential management
│   ├── agent_graph.py   # LangGraph agent workflow
│   ├── agent_state.py   # Agent state management
│   ├── agent_tools.py   # Tool definitions for agents
│   └── database/        # PostgreSQL database setup
│       ├── init.sql     # Database schema and sample data
│       ├── docker-compose.yml
│       └── readme.md
├── frontend/            # React + TypeScript frontend
└── README.md           # This file
```

## Technology Stack

### Backend
- **Python**: Core backend language
- **LangGraph**: Agent orchestration and workflow management
- **LangChain**: Tool integration and LLM abstraction
- **AWS Bedrock**: Multi-model LLM access (Claude, Llama, Mistral)
- **PostgreSQL + PostGIS**: Spatial database for location-based features
- **Docker**: Database containerization

### Frontend
- **React**: UI framework
- **TypeScript**: Type-safe development
- **Vite**: Build tool and dev server

## Setup

### Prerequisites

- Python 3.8+
- Node.js 16+
- Docker Desktop
- AWS Bedrock API access (via hackathon credentials)

### 1. Database Setup

```bash
cd backend/database
docker-compose up -d
```

The PostgreSQL database with PostGIS extension will be available at `localhost:5432`.

**Connection String:**
```
postgresql://beacon_user:beacon_local_dev@localhost:5432/beacon
```

### 2. Backend Setup

Create a `.env` file in the `backend/` directory:

```env
TEAM_ID=your_team_id
API_TOKEN=your_api_token
DATABASE_URL=postgresql://beacon_user:beacon_local_dev@localhost:5432/beacon
```

Install Python dependencies:
```bash
cd backend
pip install -r requirements.txt  # Create this if needed
```

Test the API connection:
```bash
python main.py
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Agent Architecture

The system uses LangGraph to orchestrate multiple specialized agents:

- **Coordinator Agent**: Routes requests and manages workflow
- **Database Agent**: Retrieves and updates case information
- **Matching Agent**: Pairs helpers with cases based on skills and location
- **Communication Agent**: Handles notifications and updates

### Agent State

The agent state (`AgentState`) tracks:
- Chat message history
- Emergency/case IDs (3-layer hierarchy)
- Case context from database
- Current task assignments
- Final responses

## Database Schema Highlights

### Users Table
- Dual-role system: helpers (with skills) or callers (needing help)
- Location tracking with PostGIS `POINT` type
- Skill arrays for helper matching
- Maximum travel range for helpers

### Emergency Hierarchy
1. **Emergencies**: Top-level disasters with geographic boundaries
2. **Case Groups**: Logical groupings within emergencies
3. **Cases**: Individual help requests with priority levels

### Key Features
- PostGIS spatial queries for proximity matching
- Complete audit trail via `updates` table
- Helper assignment tracking
- Status transitions (open → in_progress → resolved → closed)

## API Models

The system supports multiple LLM models via AWS Bedrock:

- **Recommended**: Claude 3.5 Sonnet (best balance)
- **Fast**: Claude 3.5 Haiku (quick responses)
- **Powerful**: Claude 3 Opus (complex reasoning)
- **Alternative**: Llama 3.2 90B, Mistral Pixtral Large

## Development

### Running the Backend
```bash
cd backend
python agent_graph.py  # Run the agent system
```

### Running the Frontend
```bash
cd frontend
npm run dev
```

### Stopping the Database
```bash
cd backend/database
docker-compose down
```

## Use Cases

1. **Wildfire Evacuation**: Coordinate safe routes and transportation
2. **Earthquake Response**: Match medical helpers with injured individuals
3. **Flood Relief**: Track stranded people and dispatch rescue teams
4. **General Emergencies**: Flexible case management for any disaster

## License

Built for the Great Agent Hack at UCL.
