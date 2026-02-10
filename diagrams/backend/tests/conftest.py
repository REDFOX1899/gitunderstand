import pytest
from fastapi.testclient import TestClient

PRODUCTION_BACKEND_URL = "https://gitdiagram-backend-308289525742.us-central1.run.app"
TEST_USERNAME = "REDFOX1899"
TEST_REPO = "gitunderstand"


@pytest.fixture
def client():
    """TestClient for the FastAPI app (no network, mocks required for AI calls)."""
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def production_url():
    """Base URL for integration tests against the deployed backend."""
    return PRODUCTION_BACKEND_URL
