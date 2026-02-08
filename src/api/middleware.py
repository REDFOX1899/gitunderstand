"""Middleware configuration for the GitUnderstand API server."""

from __future__ import annotations

import logging
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
