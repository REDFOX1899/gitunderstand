"""API tests: local TestClient tests and integration tests against production."""

import pytest
import httpx
import json
from tests.conftest import TEST_USERNAME, TEST_REPO


# ---------------------------------------------------------------------------
# Local TestClient tests (no network)
# ---------------------------------------------------------------------------

class TestLocalAPI:
    """Tests using FastAPI TestClient (runs in-process, no network required)."""

    def test_root_returns_200(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "GitDiagram" in data["message"]

    def test_generate_cost_missing_body(self, client):
        response = client.post("/generate/cost")
        assert response.status_code == 422  # validation error

    def test_generate_stream_missing_body(self, client):
        response = client.post("/generate/stream")
        assert response.status_code == 422

    def test_generate_stream_example_repo_blocked(self, client):
        """Example repos like fastapi/flask should be rejected."""
        response = client.post(
            "/generate/stream",
            json={"username": "tiangolo", "repo": "fastapi", "instructions": ""},
        )
        assert response.status_code == 200
        data = response.json()
        assert "error" in data
        assert "Example repos" in data["error"]

    def test_generate_stream_long_instructions_rejected(self, client):
        response = client.post(
            "/generate/stream",
            json={
                "username": "user",
                "repo": "repo",
                "instructions": "x" * 1001,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "error" in data
        assert "maximum length" in data["error"]

    def test_modify_missing_body(self, client):
        response = client.post("/modify")
        assert response.status_code == 422

    def test_modify_empty_instructions(self, client):
        response = client.post(
            "/modify",
            json={
                "instructions": "",
                "current_diagram": "graph TD\n  A-->B",
                "repo": "repo",
                "username": "user",
                "explanation": "test",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "error" in data


# ---------------------------------------------------------------------------
# Integration tests (hit production backend)
# ---------------------------------------------------------------------------

@pytest.mark.integration
class TestProductionAPI:
    """Integration tests that hit the deployed production backend.

    Run with: pytest -m integration
    Skip with: pytest -m "not integration"
    """

    def test_health_check(self, production_url):
        """GET / should return 200 with a greeting message."""
        response = httpx.get(f"{production_url}/", timeout=15)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    def test_generate_cost(self, production_url):
        """POST /generate/cost should return an estimated cost string."""
        response = httpx.post(
            f"{production_url}/generate/cost",
            json={
                "username": TEST_USERNAME,
                "repo": TEST_REPO,
                "instructions": "",
            },
            timeout=30,
        )
        assert response.status_code == 200
        data = response.json()
        # Should have either a cost or an error (if rate limited)
        assert "cost" in data or "error" in data
        if "cost" in data:
            assert "USD" in data["cost"]

    def test_generate_stream_sse(self, production_url):
        """POST /generate/stream should return an SSE stream.

        We only verify the initial events (started, explanation_sent) to avoid
        consuming full AI generation credits on every test run.
        """
        with httpx.stream(
            "POST",
            f"{production_url}/generate/stream",
            json={
                "username": TEST_USERNAME,
                "repo": TEST_REPO,
                "instructions": "",
            },
            timeout=60,
        ) as response:
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")

            statuses_seen = []
            for line in response.iter_lines():
                if not line.startswith("data: "):
                    continue
                payload = json.loads(line[6:])

                if "status" in payload:
                    statuses_seen.append(payload["status"])

                if "error" in payload:
                    # Rate limit or token limit is acceptable in CI
                    break

                # Stop after seeing the first explanation chunk to avoid
                # burning through full generation
                if payload.get("status") == "explanation_chunk":
                    break

            # At minimum we should have seen the started event
            assert len(statuses_seen) >= 1
            assert statuses_seen[0] == "started"
