"""Main module for the FastAPI application."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from api.config import get_settings
from api.middleware import limiter, rate_limit_exception_handler
from api.routers import health, index, ingest, summary

logger = logging.getLogger(__name__)

# Load settings
settings = get_settings()

# Initialize the FastAPI application
app = FastAPI(
    title="GitUnderstand",
    description="Convert Git repositories into LLM-friendly text digests",
    docs_url=None,
    redoc_url=None,
)
app.state.limiter = limiter

# Register the custom exception handler for rate limits
app.add_exception_handler(RateLimitExceeded, rate_limit_exception_handler)


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next) -> Response:  # noqa: ANN001
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        response.headers["X-XSS-Protection"] = "1; mode=block"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)

# CORS middleware
allowed_origins = [f"https://{h.strip()}" for h in settings.allowed_hosts.split(",")]
allowed_origins.extend(["http://localhost:8080", "http://127.0.0.1:8080"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
static_dir = Path(__file__).parent.parent.parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.head("/", include_in_schema=False)
async def head_root() -> HTMLResponse:
    """Respond to HTTP HEAD requests for the root URL.

    Returns
    -------
    HTMLResponse
        An empty HTML response with appropriate headers.

    """
    return HTMLResponse(content=None, headers={"content-type": "text/html; charset=utf-8"})


# Include routers for modular endpoints
# IMPORTANT: summary must be registered BEFORE ingest because ingest has
# a catch-all route (GET /api/{user}/{repository}) that would otherwise
# intercept /api/summary/available and /api/chat/stream.
app.include_router(health)
app.include_router(index)
app.include_router(summary)
app.include_router(ingest)
