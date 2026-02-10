"""Fixtures for production smoke tests."""

import pytest


FRONTEND_URL = "https://gitunderstand.com"
BACKEND_URL = "https://gitunderstand-308289525742.us-central1.run.app"
DIAGRAM_BACKEND_URL = "https://gitdiagram-backend-308289525742.us-central1.run.app"

TEST_USERNAME = "REDFOX1899"
TEST_REPO = "gitunderstand"


@pytest.fixture
def frontend_url():
    return FRONTEND_URL


@pytest.fixture
def backend_url():
    return BACKEND_URL


@pytest.fixture
def diagram_backend_url():
    return DIAGRAM_BACKEND_URL


@pytest.fixture
def test_repo():
    return {"username": TEST_USERNAME, "repo": TEST_REPO}
