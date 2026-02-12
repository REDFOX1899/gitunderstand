"""Middleware configuration for the GitUnderstand API server."""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import TYPE_CHECKING

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

if TYPE_CHECKING:
    from fastapi import Request
    from fastapi.responses import Response

logger = logging.getLogger(__name__)

# Initialize a rate limiter using the client's remote address as the key
limiter = Limiter(key_func=get_remote_address)


# ---------------------------------------------------------------------------
# AI usage quota: 5 AI requests per 6-hour window per IP
# Persisted to disk so quota survives deploys/restarts.
# ---------------------------------------------------------------------------
AI_QUOTA_LIMIT = 5
AI_QUOTA_WINDOW = 6 * 60 * 60  # 6 hours in seconds

_QUOTA_FILE = Path("/tmp/gitunderstand_ai_quota.json")  # noqa: S108


def _load_usage() -> dict[str, list[float]]:
    """Load AI usage data from disk, returning empty dict on any error."""
    try:
        if _QUOTA_FILE.exists():
            data = json.loads(_QUOTA_FILE.read_text())
            if isinstance(data, dict):
                return {k: v for k, v in data.items() if isinstance(v, list)}
    except (json.JSONDecodeError, OSError):
        logger.debug("Could not load AI quota file, starting fresh")
    return {}


def _save_usage(usage: dict[str, list[float]]) -> None:
    """Persist AI usage data to disk."""
    try:
        _QUOTA_FILE.write_text(json.dumps(usage))
    except OSError:
        logger.debug("Could not save AI quota file")


def check_ai_quota(request: Request) -> tuple[bool, int, int]:
    """Check whether the requesting IP has remaining AI quota.

    Returns (allowed, remaining, seconds_until_reset).
    """
    ip = get_remote_address(request)
    now = time.time()
    cutoff = now - AI_QUOTA_WINDOW

    usage = _load_usage()
    timestamps = [ts for ts in usage.get(ip, []) if ts > cutoff]
    used = len(timestamps)
    remaining = max(0, AI_QUOTA_LIMIT - used)

    if used >= AI_QUOTA_LIMIT:
        earliest = min(timestamps)
        seconds_until_reset = int(earliest + AI_QUOTA_WINDOW - now) + 1
        return False, 0, seconds_until_reset

    return True, remaining, 0


def record_ai_usage(request: Request) -> None:
    """Record one AI request for the IP."""
    ip = get_remote_address(request)
    now = time.time()
    cutoff = now - AI_QUOTA_WINDOW

    usage = _load_usage()
    timestamps = usage.get(ip, [])
    timestamps.append(now)
    usage[ip] = [ts for ts in timestamps if ts > cutoff]

    # Evict expired IPs
    expired_ips = [k for k, v in usage.items() if not any(ts > cutoff for ts in v)]
    for k in expired_ips:
        del usage[k]

    _save_usage(usage)


def get_ai_quota_info(request: Request) -> dict:
    """Return current quota info for the requesting IP."""
    ip = get_remote_address(request)
    now = time.time()
    cutoff = now - AI_QUOTA_WINDOW

    usage = _load_usage()
    timestamps = [ts for ts in usage.get(ip, []) if ts > cutoff]
    used = len(timestamps)
    remaining = max(0, AI_QUOTA_LIMIT - used)
    return {"limit": AI_QUOTA_LIMIT, "remaining": remaining, "window_hours": 6}


async def rate_limit_exception_handler(request: Request, exc: Exception) -> Response:
    """Handle rate-limiting errors with a custom exception handler.

    Parameters
    ----------
    request : Request
        The incoming HTTP request.
    exc : Exception
        The exception raised, expected to be ``RateLimitExceeded``.

    Returns
    -------
    Response
        A response indicating that the rate limit has been exceeded.

    Raises
    ------
    exc
        If the exception is not a ``RateLimitExceeded`` error, it is re-raised.

    """
    if isinstance(exc, RateLimitExceeded):
        return _rate_limit_exceeded_handler(request, exc)
    raise exc
