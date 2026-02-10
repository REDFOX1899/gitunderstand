"""
Production smoke tests for GitUnderstand + GitDiagram.

Run with:
    cd diagrams && python -m pytest tests/ -v -m smoke

Requires: httpx, pytest
"""

import json

import httpx
import pytest

pytestmark = pytest.mark.smoke

TIMEOUT = httpx.Timeout(30.0, connect=10.0)


# ---------------------------------------------------------------------------
# 1. Frontend health
# ---------------------------------------------------------------------------

class TestFrontendHealth:
    def test_homepage_returns_200(self, frontend_url):
        """GET / should return 200 with HTML content."""
        r = httpx.get(frontend_url, timeout=TIMEOUT, follow_redirects=True)
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")

    def test_diagrams_page_returns_200(self, frontend_url):
        """GET /diagrams should return 200."""
        r = httpx.get(f"{frontend_url}/diagrams", timeout=TIMEOUT, follow_redirects=True)
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")


# ---------------------------------------------------------------------------
# 2. GitUnderstand Ingest API (direct backend URL)
# ---------------------------------------------------------------------------

class TestIngestAPI:
    def test_ingest_sync(self, backend_url, test_repo):
        """POST /api/ingest should return content, short_repo_url, and tree."""
        payload = {
            "input_text": f"https://github.com/{test_repo['username']}/{test_repo['repo']}",
            "max_file_size": 50,
            "pattern_type": "exclude",
            "pattern": "",
            "output_format": "text",
        }
        r = httpx.post(
            f"{backend_url}/api/ingest",
            json=payload,
            timeout=httpx.Timeout(120.0, connect=10.0),
            follow_redirects=True,
        )
        assert r.status_code == 200, f"Ingest returned {r.status_code}: {r.text[:500]}"
        data = r.json()
        assert "content" in data, f"Missing 'content' in response: {list(data.keys())}"
        assert "short_repo_url" in data, f"Missing 'short_repo_url' in response"
        assert "tree" in data, f"Missing 'tree' in response"
        assert len(data["content"]) > 0, "Content should not be empty"


# ---------------------------------------------------------------------------
# 3. Diagram backend health
# ---------------------------------------------------------------------------

class TestDiagramBackendHealth:
    def test_root_endpoint(self, diagram_backend_url):
        """GET / on diagram backend should return a JSON message."""
        r = httpx.get(diagram_backend_url, timeout=TIMEOUT, follow_redirects=True)
        assert r.status_code == 200
        data = r.json()
        assert "message" in data


# ---------------------------------------------------------------------------
# 4. Diagram generation cost endpoint
# ---------------------------------------------------------------------------

class TestDiagramCost:
    def test_generation_cost(self, diagram_backend_url, test_repo):
        """POST /generate/cost should return an estimated cost string."""
        payload = {
            "username": test_repo["username"],
            "repo": test_repo["repo"],
            "instructions": "",
        }
        r = httpx.post(
            f"{diagram_backend_url}/generate/cost",
            json=payload,
            timeout=httpx.Timeout(60.0, connect=10.0),
            follow_redirects=True,
        )
        assert r.status_code == 200, f"Cost returned {r.status_code}: {r.text[:500]}"
        data = r.json()
        assert "cost" in data, f"Missing 'cost' in response: {data}"
        assert "$" in data["cost"], f"Cost should contain '$': {data['cost']}"


# ---------------------------------------------------------------------------
# 5. Diagram generation stream (partial — just verify SSE starts)
# ---------------------------------------------------------------------------

class TestDiagramStream:
    def test_stream_starts(self, diagram_backend_url, test_repo):
        """POST /generate/stream should start an SSE stream with expected events."""
        payload = {
            "username": test_repo["username"],
            "repo": test_repo["repo"],
            "instructions": "",
        }
        # Use streaming to read only the first few events
        events_received = []
        with httpx.stream(
            "POST",
            f"{diagram_backend_url}/generate/stream",
            json=payload,
            timeout=httpx.Timeout(60.0, connect=10.0),
        ) as response:
            assert response.status_code == 200, (
                f"Stream returned {response.status_code}"
            )
            assert "text/event-stream" in response.headers.get("content-type", "")

            for line in response.iter_lines():
                if line.startswith("data: "):
                    try:
                        event = json.loads(line[6:])
                        events_received.append(event.get("status", ""))
                    except json.JSONDecodeError:
                        continue

                # Stop after we see 'explanation_sent' or collect a few events
                if "explanation_sent" in events_received or len(events_received) >= 5:
                    break

        assert len(events_received) > 0, "Should receive at least one SSE event"
        assert "started" in events_received, (
            f"Expected 'started' event, got: {events_received}"
        )
