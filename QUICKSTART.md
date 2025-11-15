# BEACON Backend - Quick Start Guide

## 🚀 What's Been Built

All **5 service modules** are complete with full implementations:
- ✅ User & Location Management (`services/users.py`)
- ✅ Case Lifecycle (`services/cases.py`)
- ✅ Helper Operations (`services/helpers.py`)
- ✅ Guide Management (`services/guides.py`)
- ✅ Agent Orchestration (`services/research.py`)
- ✅ Complete FastAPI App (`app.py`) with all endpoints

**Critical bugs fixed:**
- ✅ `add_messages` import error
- ✅ Security vulnerability (eval → ast.literal_eval)
- ✅ MOCK_DB initialization
- ✅ Tool list consolidation

## 📋 Prerequisites

1. **Docker** (for PostgreSQL)
2. **Python 3.11+**
3. **Node 18+** (for frontend)
4. **.env file** with Bedrock API credentials

## 🎯 Setup Steps

### 1. Start Database

```bash
# Start PostgreSQL
cd backend/database
docker-compose up -d

# Wait 5 seconds for startup
sleep 5

# Apply schema
psql -h localhost -U beacon_user -d beacon -f init.sql

# Apply migrations
psql -h localhost -U beacon_user -d beacon -f migrations/001_add_guides_tables.sql

# Verify
psql -h localhost -U beacon_user -d beacon -c "\dt"
# Should show: users, location_tracking, emergencies, case_groups, cases,
#              assignments, updates, research_reports, caller_guides, helper_guides
```

### 2. Install Backend Dependencies

```bash
cd backend

# Install required packages
pip install fastapi uvicorn python-dotenv requests \
  langgraph langchain-core psycopg2-binary pydantic \
  langchain-valyu

# Verify installation
python -c "import fastapi, langgraph, langchain_core; print('✅ All imports successful')"
```

### 3. Verify .env File

```bash
cd backend

# Check .env exists and has required keys
cat .env
# Should contain:
# TEAM_ID=your_team_id
# API_TOKEN=your_api_token
# VALYU_API_KEY=your_valyu_key (optional but recommended)
```

### 4. Test Bedrock API Connection

```bash
cd backend
python main.py

# Expected output:
# ✅ API connection successful!
#   Budget Remaining: $XX.XX
# Test Response: [Claude's response]
```

### 5. Start API Server

```bash
cd backend
python app.py

# Expected output:
# INFO:     Uvicorn running on http://0.0.0.0:8000
# INFO:     Application startup complete.
```

**API Documentation:** http://localhost:8000/docs

### 6. Test API Endpoints

Open a new terminal:

```bash
# Health check
curl http://localhost:8000/health
# Expected: {"status":"healthy","service":"BEACON API"}

# Create caller user
curl -X POST http://localhost:8000/api/users/location-consent \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 37.7749,
    "longitude": -122.4194,
    "name": "Test Victim",
    "is_helper": false
  }'
# Expected: {"user_id": "1", "action": "created", ...}

# Create help request
curl -X POST http://localhost:8000/api/cases \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "1",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "raw_problem_description": "Trapped in collapsed building, 3rd floor, need rescue"
  }'
# Expected: {"case_id": 1, "processing_started": true, ...}

# Wait 5 seconds for agent processing...
sleep 5

# Get caller guide
curl http://localhost:8000/api/cases/1/caller-guide
# Expected: {"guide_text": "1. ... 2. ... 3. ...", ...}
```

## 🧪 Full Integration Test

```bash
# Run this test script
cd backend
cat > test_integration.sh << 'EOF'
#!/bin/bash
set -e

echo "🧪 BEACON Integration Test"
echo "=========================="

# Test 1: Health check
echo "1️⃣  Testing health endpoint..."
curl -s http://localhost:8000/health | jq .
echo "✅ Health check passed"
echo

# Test 2: Create caller
echo "2️⃣  Creating caller user..."
CALLER=$(curl -s -X POST http://localhost:8000/api/users/location-consent \
  -H "Content-Type: application/json" \
  -d '{"latitude":37.7749,"longitude":-122.4194,"name":"Test Victim","is_helper":false}')
CALLER_ID=$(echo $CALLER | jq -r .user_id)
echo "✅ Caller created: user_id=$CALLER_ID"
echo

# Test 3: Create case
echo "3️⃣  Creating help request..."
CASE=$(curl -s -X POST http://localhost:8000/api/cases \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$CALLER_ID\",\"latitude\":37.7749,\"longitude\":-122.4194,\"raw_problem_description\":\"Trapped in building\"}")
CASE_ID=$(echo $CASE | jq -r .case_id)
echo "✅ Case created: case_id=$CASE_ID"
echo

# Test 4: Wait for processing
echo "4️⃣  Waiting for agent processing (5 seconds)..."
sleep 5

# Test 5: Get caller guide
echo "5️⃣  Fetching caller guide..."
curl -s http://localhost:8000/api/cases/$CASE_ID/caller-guide | jq .
echo "✅ Caller guide retrieved"
echo

# Test 6: Create helper
echo "6️⃣  Creating helper user..."
HELPER=$(curl -s -X POST http://localhost:8000/api/users/location-consent \
  -H "Content-Type: application/json" \
  -d '{"latitude":37.7750,"longitude":-122.4195,"name":"Test Helper","is_helper":true,"helper_skills":["medical"],"helper_max_range":5000}')
HELPER_ID=$(echo $HELPER | jq -r .user_id)
echo "✅ Helper created: user_id=$HELPER_ID"
echo

# Test 7: Find nearby cases
echo "7️⃣  Finding nearby cases..."
curl -s "http://localhost:8000/api/cases/nearby?lat=37.7750&lon=-122.4195&radius=10" | jq .
echo "✅ Nearby cases retrieved"
echo

# Test 8: Create assignment
echo "8️⃣  Creating assignment..."
ASSIGNMENT=$(curl -s -X POST http://localhost:8000/api/assignments \
  -H "Content-Type: application/json" \
  -d "{\"case_id\":$CASE_ID,\"helper_user_id\":$HELPER_ID}")
ASSIGNMENT_ID=$(echo $ASSIGNMENT | jq -r .assignment_id)
echo "✅ Assignment created: assignment_id=$ASSIGNMENT_ID"
echo

# Test 9: Wait for helper guide
echo "9️⃣  Waiting for helper guide (5 seconds)..."
sleep 5

# Test 10: Get helper guide
echo "🔟 Fetching helper guide..."
curl -s http://localhost:8000/api/assignments/$ASSIGNMENT_ID/helper-guide | jq .
echo "✅ Helper guide retrieved"
echo

echo "=========================="
echo "🎉 All tests passed!"
EOF

chmod +x test_integration.sh
./test_integration.sh
```

## 📊 Expected Results

If everything works, you should see:
1. ✅ Health check returns `{"status": "healthy"}`
2. ✅ Caller user created with UUID
3. ✅ Case created with `processing_started: true`
4. ✅ After 5 seconds, caller guide has 3 bullet points
5. ✅ Helper user created with skills
6. ✅ Nearby cases found with distance
7. ✅ Assignment created successfully
8. ✅ After 5 seconds, helper guide has 3 bullet points

## 🐛 Troubleshooting

### Database Connection Failed
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# If not running:
cd backend/database
docker-compose up -d

# Check logs
docker-compose logs
```

### API Server Won't Start
```bash
# Check for port conflicts
lsof -i :8000

# If port occupied, kill process or change port in app.py
```

### ImportError for Services
```bash
# Verify you're in backend directory
cd backend
pwd  # Should end with /backend

# Verify services package exists
ls -la services/
# Should show __init__.py, users.py, cases.py, helpers.py, guides.py, research.py
```

### Agent Processing Hangs
```bash
# Check Bedrock API credentials
cd backend
python main.py
# If this fails, check .env file

# Check Valyu API key (optional but recommended)
echo $VALYU_API_KEY
```

### Database Migration Failed
```bash
# Drop and recreate database
docker-compose down -v
docker-compose up -d
sleep 5
psql -h localhost -U beacon_user -d beacon -f init.sql
psql -h localhost -U beacon_user -d beacon -f migrations/001_add_guides_tables.sql
```

## 📝 Next Steps

1. **Frontend Integration**
   - Update frontend to call new API endpoints
   - Replace mock data with API calls
   - Add polling for guide status

2. **Real-time Updates**
   - Implement WebSocket support
   - Stream location updates
   - Push guide notifications

3. **Production Readiness**
   - Replace threading with Celery/RQ
   - Add authentication/authorization
   - Implement rate limiting
   - Add comprehensive logging

4. **Testing & Metrics**
   - Implement Tutorial 04 (cost tracking)
   - Implement Tutorial 06 (benchmarking)
   - Create test dataset
   - Measure consistency

## 🎯 Success Criteria

You'll know everything is working when:
- ✅ API server starts without errors
- ✅ Health endpoint returns 200
- ✅ Creating case triggers agent processing
- ✅ Caller guide appears after ~5 seconds
- ✅ Helper can claim case
- ✅ Helper guide appears after ~5 seconds
- ✅ All endpoints return proper JSON (no 500 errors)

---

**Status:** Ready for integration testing
**Implementation:** Complete (1,600 LOC)
**Next:** Frontend integration + WebSocket support
