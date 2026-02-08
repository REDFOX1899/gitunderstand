"""Module containing the routers for the FastAPI application."""

from api.routers.health import router as health
from api.routers.index import router as index
from api.routers.ingest import router as ingest

__all__ = ["health", "index", "ingest"]
