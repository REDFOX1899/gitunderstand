"""Health check endpoint for the GitUnderstand API."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint to verify that the server is running.

    Returns
    -------
    dict[str, str]
        A JSON object with a "status" key indicating the server's health status.

    """
    return {"status": "ok"}
