"""Tests for the health endpoint and API edge cases."""

import pytest


class TestHealthEndpoint:
    """Tests for the /health endpoint."""

    def test_health_returns_200(self, client):
        """Health endpoint should return 200 with status ok."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


class TestModifyEndpoint:
    """Additional tests for the /modify endpoint."""

    def test_modify_example_repo_blocked(self, client):
        """Example repos should be rejected for modification."""
        response = client.post(
            "/modify",
            json={
                "instructions": "Add a new component",
                "current_diagram": "graph TD\n  A-->B",
                "repo": "fastapi",
                "username": "tiangolo",
                "explanation": "test",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "error" in data
        assert "Example repos" in data["error"]

    def test_modify_long_instructions_rejected(self, client):
        """Instructions over 1000 chars should be rejected."""
        response = client.post(
            "/modify",
            json={
                "instructions": "x" * 1001,
                "current_diagram": "graph TD\n  A-->B",
                "repo": "repo",
                "username": "user",
                "explanation": "test",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "error" in data
        assert "maximum length" in data["error"]

    def test_modify_long_diagram_rejected(self, client):
        """Diagrams over 100k chars should be rejected."""
        response = client.post(
            "/modify",
            json={
                "instructions": "Fix it",
                "current_diagram": "x" * 100001,
                "repo": "repo",
                "username": "user",
                "explanation": "test",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "error" in data

    def test_modify_missing_current_diagram(self, client):
        """Empty current_diagram should return error."""
        response = client.post(
            "/modify",
            json={
                "instructions": "Fix it",
                "current_diagram": "",
                "repo": "repo",
                "username": "user",
                "explanation": "test",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "error" in data


class TestGenerateCostEndpoint:
    """Tests for the /generate/cost endpoint validation."""

    def test_cost_missing_body(self, client):
        """Missing body should return 422."""
        response = client.post("/generate/cost")
        assert response.status_code == 422

    def test_cost_missing_required_fields(self, client):
        """Missing required fields should return 422."""
        response = client.post("/generate/cost", json={"username": "user"})
        assert response.status_code == 422
