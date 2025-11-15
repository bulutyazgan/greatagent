"""
Basic tests for the API endpoints
Run with: pytest test_api.py -v
"""
import pytest
from fastapi.testclient import TestClient
from api import app

client = TestClient(app)


def test_health_check():
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_create_user():
    """Test creating a user"""
    user_data = {
        "name": "Test User",
        "location": {"latitude": 37.7749, "longitude": -122.4194},
        "contact_info": "test@example.com",
        "helper_skills": ["medical", "first_aid"],
        "helper_max_range": 5000
    }
    response = client.post("/users", json=user_data)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test User"
    assert "id" in data


def test_get_users():
    """Test getting all users"""
    response = client.get("/users")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_user_not_found():
    """Test getting a non-existent user"""
    response = client.get("/users/999999")
    assert response.status_code == 404


def test_create_emergency():
    """Test creating an emergency"""
    emergency_data = {
        "name": "Test Wildfire",
        "area": "Test Area",
        "description": "Test emergency",
        "type": "wildfire",
        "status": "active",
        "severity_level": "high"
    }
    response = client.post("/emergencies", json=emergency_data)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Wildfire"
    assert "id" in data


def test_get_emergencies():
    """Test getting all emergencies"""
    response = client.get("/emergencies")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_pagination():
    """Test pagination parameters"""
    response = client.get("/users?skip=0&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 10
