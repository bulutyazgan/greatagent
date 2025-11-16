# LangSmith Integration - Code Examples

This file shows practical code examples and patterns used in the BEACON LangSmith integration.

## 1. Basic Setup in main.py

```python
import os
from dotenv import load_dotenv

load_dotenv()

# LangSmith observability
LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY")
LANGSMITH_PROJECT = os.getenv("LANGSMITH_PROJECT", "beacon-demo")

# These are imported by other modules
```

## 2. Agent Instrumentation in agent_graph.py

### Example: intake_agent with @traceable

```python
import time
from langsmith import traceable, Client

@traceable(name="intake_agent", tags=["extraction", "user_input"])
def intake_agent(state: AgentState):
    """
    Intake agent: turns raw user text + GPS into a structured case object.
    
    LangSmith will automatically:
    - Create a run in the "beacon-demo" project
    - Capture execution time
    - Log all inputs and outputs
    - Record any errors with stack traces
    """
    logger.info("Starting intake_agent")
    start_time = time.time()
    
    # Extract user input
    messages = state["messages"]
    last_user_msg = None
    for m in reversed(messages):
        if m.get("role") == "user":
            last_user_msg = m.get("content")
            break

    latitude = state.get("latitude")
    longitude = state.get("longitude")
    caller_user_id = state.get("caller_user_id")

    # Validation with logging (appears in LangSmith trace)
    if last_user_msg is None or latitude is None or longitude is None:
        error_msg = "Could not extract case: missing text or location."
        logger.warning(f"intake_agent failed: {error_msg}")
        return {
            "messages": [{"role": "assistant", "content": error_msg}],
            "case_context": None,
        }

    # Build LLM request
    system_prompt = "You are an emergency intake agent..."
    body = {
        "team_id": TEAM_ID,
        "api_token": API_TOKEN,
        "model": fast_model_id,  # Use fast model for cost efficiency
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"User text: {last_user_msg}..."}
        ],
        "max_tokens": 512,
    }

    # LLM call with error handling
    try:
        response = api_client.post(API_ENDPOINT, json=body, timeout=30)
        response.raise_for_status()
        result = response.json()
        raw_content = result.get("content", [])[0].get("text", "{}")
        case_obj = json.loads(raw_content)
    except Exception as e:
        # Error is auto-captured by LangSmith
        logger.error(f"LLM call failed: {e}. Using fallback.")
        case_obj = {
            "caller_user_id": caller_user_id,
            "location": [latitude, longitude],
            "description": last_user_msg,
            "urgency": "high",
            "danger_level": "severe",
            # ... other fallback fields
        }

    # Timing measurement (useful for performance tracking)
    elapsed = time.time() - start_time
    logger.info(f"intake_agent completed in {elapsed:.3f}s")

    confirmation_msg = (
        f"Created structured case at ({latitude}, {longitude}). "
        f"Urgency: {case_obj.get('urgency')}, danger: {case_obj.get('danger_level')}."
    )

    return {
        "messages": [{"role": "assistant", "content": confirmation_msg}],
        "case_context": case_obj,
    }
```

**What LangSmith captures**:
- ✅ `@traceable` decorator creates automatic run
- ✅ All `logger.info/warning/error` calls included in trace
- ✅ Execution time automatically measured (0.34s)
- ✅ Inputs: `state` dict with messages, coordinates, user_id
- ✅ Outputs: returned dict with confirmation_msg and case_context
- ✅ Errors: Full exception logged with fallback action taken

### Example: case_group_manager_agent with error recovery

```python
@traceable(name="case_group_manager", tags=["grouping", "proximity"])
def case_group_manager_agent(state: AgentState):
    """Groups nearby cases into case groups."""
    logger.info("Starting case_group_manager_agent")
    start_time = time.time()
    
    case_id = state.get("case_id") or (state.get("case_context") or {}).get("id")
    if not case_id:
        logger.warning("case_group_manager: No case ID provided")
        return {"messages": [{"role": "assistant", "content": "No case ID provided."}]}
    
    try:
        grouping_result = agent_tools.process_case_grouping(case_id=case_id)
        
        if grouping_result.get("group_created"):
            msg = f"Case group {grouping_result['case_group_id']} created for cases: {grouping_result['cases']}."
            logger.info(f"Group created: {grouping_result['case_group_id']}")
        else:
            msg = f"No new group created. Nearby open cases: {grouping_result['cases_found']}."
            logger.info(f"No grouping needed: {len(grouping_result['cases_found'])} nearby cases")
        
        elapsed = time.time() - start_time
        logger.info(f"case_group_manager_agent completed in {elapsed:.3f}s")
        
        return {"messages": [{"role": "assistant", "content": msg}], "case_group_update": grouping_result}
    except Exception as e:
        logger.error(f"case_group_manager_agent failed: {e}")
        elapsed = time.time() - start_time
        logger.info(f"case_group_manager_agent completed (with error) in {elapsed:.3f}s")
        raise  # LangSmith captures the error
```

## 3. API Endpoints in app.py

### Example: Create Case with run_id Tracking

```python
from uuid import uuid4
from langsmith import Client

# Initialize client
ls_client = Client()

@app.post("/api/cases", status_code=201)
def create_case(request: CreateCaseRequest):
    """
    Create new case (caller bootstrap).
    Returns case with run_id for LangSmith tracing.
    """
    try:
        # Generate unique run ID for tracing
        run_id = str(uuid4())
        
        # Build metadata for filtering
        metadata = {
            "endpoint": "/api/cases",
            "caller_user_id": request.user_id,
            "location": [request.latitude, request.longitude],
            "input_length": len(request.raw_problem_description),
            "emergency_id": request.emergency_id,
        }
        
        logger.info(f"Creating case with run_id={run_id}", extra={"metadata": metadata})
        
        # Call service (which triggers agent_graph internally)
        result = cases.create_case(
            user_id=request.user_id,
            latitude=request.latitude,
            longitude=request.longitude,
            raw_problem_description=request.raw_problem_description,
            emergency_id=request.emergency_id
        )
        
        # Attach run_id to response so client can use it for feedback
        result["run_id"] = run_id
        
        logger.info(f"Case created: {result.get('id')} with run_id={run_id}")
        
        return result
    except Exception as e:
        logger.error(f"Case creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

**Client would use like**:
```javascript
// Frontend
const response = await fetch('/api/cases', {
  method: 'POST',
  body: JSON.stringify({
    latitude: 37.7749,
    longitude: -122.4194,
    raw_problem_description: "Fire in my apartment!"
  })
});

const { case_id, run_id } = await response.json();

// Later: send feedback
await fetch('/api/feedback', {
  method: 'POST',
  body: JSON.stringify({
    run_id: run_id,
    score: 1.0,  // Thumbs up
    comment: "Very helpful!"
  })
});
```

### Example: Feedback Endpoint

```python
@app.post("/api/feedback")
async def log_feedback(run_id: str, score: float, comment: Optional[str] = None):
    """
    Log user feedback to LangSmith.
    score: 1.0 = thumbs up, 0.0 = thumbs down, 0.5 = neutral
    """
    try:
        ls_client.create_feedback(
            run_id=run_id,
            key="user_rating",
            score=score,
            comment=comment,
        )
        logger.info(f"Feedback logged for run {run_id}: score={score}")
        return {"status": "feedback_logged", "run_id": run_id}
    except Exception as e:
        logger.error(f"Feedback logging failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Example: Metrics Endpoint

```python
from datetime import datetime, timedelta

@app.get("/api/metrics")
async def get_metrics(hours: int = Query(1, ge=1, le=24)):
    """
    Aggregated metrics from LangSmith.
    
    Example: /api/metrics?hours=4
    Returns stats from last 4 hours.
    """
    try:
        # Query LangSmith for recent runs
        recent_runs = ls_client.list_runs(
            project_name=LANGSMITH_PROJECT,
            start_time=datetime.now() - timedelta(hours=hours),
            limit=1000,
        )
        
        runs = list(recent_runs)
        
        if not runs:
            return {
                "time_window_hours": hours,
                "total_runs": 0,
                "error": "No runs found"
            }
        
        # Aggregate metrics
        total_runs = len(runs)
        successful = sum(1 for r in runs if r.status == "success")
        failed = sum(1 for r in runs if r.status == "error")
        avg_latency = sum(r.latency or 0 for r in runs) / total_runs if total_runs > 0 else 0
        
        # Token usage aggregation
        total_tokens = 0
        for r in runs:
            if r.metadata and "token_usage" in r.metadata:
                total_tokens += r.metadata["token_usage"]
        
        # Cost calculation
        cost_estimate = (total_tokens / 1000) * 0.003  # $0.003 per 1K tokens (approx)
        
        logger.info(f"Metrics: {total_runs} runs in {hours}h, {successful} successful")
        
        return {
            "time_window_hours": hours,
            "total_runs": total_runs,
            "successful": successful,
            "failed": failed,
            "success_rate": successful / total_runs if total_runs > 0 else 0,
            "avg_latency_seconds": avg_latency,
            "total_tokens": total_tokens,
            "cost_estimate_usd": round(cost_estimate, 4),
            "cost_per_run_usd": round(cost_estimate / total_runs, 6) if total_runs > 0 else 0,
        }
    except Exception as e:
        logger.error(f"Metrics query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

## 4. Query Patterns for Custom Analysis

### Filter by Tags

```python
# In a utility function or Jupyter notebook
from langsmith import Client

client = Client()

# Get all "extraction" runs
extraction_runs = list(client.list_runs(
    project_name="beacon-demo",
    filter={"tags": ["extraction"]}
))

print(f"Found {len(extraction_runs)} extraction runs")
for run in extraction_runs[:5]:
    print(f"  {run.name}: {run.latency}s, status={run.status}")
```

### Filter by Metadata

```python
# Get runs for specific user
user_runs = list(client.list_runs(
    project_name="beacon-demo",
    filter={"metadata.caller_user_id": "user123"}
))

# Get cases in specific region
region_runs = list(client.list_runs(
    project_name="beacon-demo",
    filter={"metadata.region": "SF_downtown"}
))
```

### Calculate Custom Metrics

```python
# Get all runs from last hour
recent_runs = list(client.list_runs(
    project_name="beacon-demo",
    start_time=datetime.now() - timedelta(hours=1),
    limit=1000,
))

# Find slowest agents
slow_runs = sorted(recent_runs, key=lambda r: r.latency or 0, reverse=True)[:5]
for run in slow_runs:
    print(f"Slowest: {run.name} took {run.latency}s")

# Find errors by type
errors_by_type = {}
for run in recent_runs:
    if run.status == "error":
        error_type = run.error[:50]  # First 50 chars
        errors_by_type[error_type] = errors_by_type.get(error_type, 0) + 1

print("Errors by type:", errors_by_type)
```

## 5. Testing LangSmith Integration

### Unit Test Example

```python
import pytest
from unittest.mock import patch, MagicMock
from main import LANGSMITH_PROJECT

def test_intake_agent_traces():
    """Verify intake_agent creates LangSmith traces."""
    from agent_graph import intake_agent
    from agent_state import AgentState
    
    state = AgentState(
        messages=[{"role": "user", "content": "Fire in building!"}],
        latitude=37.7749,
        longitude=-122.4194,
        caller_user_id=123
    )
    
    # Mock the API call
    with patch('agent_graph.api_client') as mock_client:
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "content": [{"text": '{"urgency": "critical", "danger_level": "severe"}'}]
        }
        mock_client.post.return_value = mock_response
        
        result = intake_agent(state)
        
        # Verify output
        assert result["case_context"] is not None
        assert result["case_context"]["urgency"] == "critical"
        
        # Verify API was called
        mock_client.post.assert_called_once()

def test_metrics_endpoint():
    """Verify /api/metrics returns proper structure."""
    from app import client as app_client  # FastAPI TestClient
    
    response = app_client.get("/api/metrics?hours=1")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "total_runs" in data
    assert "success_rate" in data
    assert "avg_latency_seconds" in data
    assert "cost_estimate_usd" in data
```

### Manual Testing

```bash
# 1. Create a test case
curl -X POST http://localhost:8000/api/cases \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 37.7749,
    "longitude": -122.4194,
    "raw_problem_description": "Test case for LangSmith"
  }' | jq -r '.run_id' > run_id.txt

RUN_ID=$(cat run_id.txt)

# 2. Check metrics (wait a few seconds first)
sleep 10
curl http://localhost:8000/api/metrics

# 3. Send feedback
curl -X POST http://localhost:8000/api/feedback \
  -H "Content-Type: application/json" \
  -d "{
    \"run_id\": \"$RUN_ID\",
    \"score\": 1.0,
    \"comment\": \"Excellent response time\"
  }"

# 4. View in LangSmith dashboard
echo "Check: https://smith.langchain.com/o/.../projects/beacon-demo"
```

## 6. Performance Optimization Tips

### Use Faster Model for Non-Critical Tasks

```python
# In intake_agent - use Haiku for extraction (cheaper, faster)
body = {
    "model": MODELS["fast"],  # Haiku: ~0.1s per call, ~$0.001
    # ...
}

# For complex reasoning, use Sonnet
body = {
    "model": MODELS["recommended"],  # Sonnet: ~0.3s per call, ~$0.003
    # ...
}
```

### Cache Common Queries

```python
# Avoid repeated DB queries
from functools import lru_cache

@lru_cache(maxsize=100)
def get_nearby_cases(lat: float, lon: float, radius: float):
    """Cached version of proximity search."""
    return agent_tools.process_case_grouping(lat, lon, radius)
```

### Monitor Token Usage

```python
# Track tokens per model
metadata = {
    "model_used": "haiku",  # Cheaper
    "tokens_used": 150,
    "estimated_cost_usd": 0.0005,
}
```

## References

- [LangSmith Tracing Documentation](https://docs.smith.langchain.com/tracing)
- [LangSmith Python Client](https://docs.smith.langchain.com/reference)
- [Best Practices](https://docs.smith.langchain.com/user_guide/tracing/best_practices)
