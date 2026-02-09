"""AI summary and chat endpoints for the GitUnderstand API."""

from __future__ import annotations

import json
import logging
import os
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from api.config import get_settings
from api.middleware import limiter
from api.models import ChatRequest, SummaryRequest  # noqa: TC001
from core.ai_summary import SummaryType, generate_chat_response, generate_summary
from storage.factory import get_storage

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

logger = logging.getLogger(__name__)

settings = get_settings()
router = APIRouter()


def _format_sse(event: dict[str, Any]) -> str:
    """Format a dict as an SSE ``data:`` line."""
    return f"data: {json.dumps(event)}\n\n"


@router.get("/api/summary/available")
async def summary_available() -> JSONResponse:
    """Check whether AI summary generation is available.

    Returns ``{"available": true}`` when a Claude API key is configured,
    ``{"available": false}`` otherwise.  The frontend uses this to
    conditionally show the AI Analysis section.

    Returns
    -------
    JSONResponse
        JSON object with ``available`` boolean.

    """
    available = bool(settings.claude_api_key)
    if not available:
        logger.warning(
            "AI summary not available: claude_api_key is empty. "
            "ENV CLAUDE_API_KEY=%s",
            "SET" if os.environ.get("CLAUDE_API_KEY") else "NOT SET",
        )
    return JSONResponse({"available": available})


@router.post("/api/summary/stream")
@limiter.limit("10/minute")
async def api_summary_stream(
    request: Request,
    summary_request: SummaryRequest,
) -> StreamingResponse:
    """Stream AI summary generation as Server-Sent Events.

    Checks the cache first — if a summary already exists for this
    digest + summary_type, it is returned immediately.  Otherwise,
    the Claude API is called and the result is cached.

    Parameters
    ----------
    request : Request
        The incoming HTTP request (used by rate limiter).
    summary_request : SummaryRequest
        Request body with ``digest_id`` and ``summary_type``.

    Returns
    -------
    StreamingResponse
        SSE stream with progress events.

    """

    async def event_generator() -> AsyncGenerator[str, None]:
        digest_id = summary_request.digest_id
        summary_type_str = summary_request.summary_type

        # Validate summary type
        try:
            summary_type = SummaryType(summary_type_str)
        except ValueError:
            yield _format_sse({
                "type": "error",
                "payload": {"message": f"Invalid summary type: {summary_type_str}"},
            })
            return

        # Check API key
        if not settings.claude_api_key:
            yield _format_sse({
                "type": "error",
                "payload": {"message": "AI summaries are not configured (missing API key)"},
            })
            return

        storage = get_storage()

        # Check cache first
        cached_summary = storage.get_summary(digest_id, summary_type.value)
        if cached_summary:
            logger.info("Serving cached %s summary for digest %s", summary_type.value, digest_id)
            yield _format_sse({
                "type": "complete",
                "payload": {
                    "summary_type": summary_type.value,
                    "content": cached_summary,
                    "cached": True,
                },
            })
            return

        # Emit generating event
        yield _format_sse({
            "type": "generating",
            "payload": {
                "summary_type": summary_type.value,
                "message": f"Generating {summary_type.value.replace('_', ' ')} with Claude...",
            },
        })

        # Retrieve digest content + metadata
        digest_content = storage.get_digest(digest_id)
        if not digest_content:
            yield _format_sse({
                "type": "error",
                "payload": {"message": f"Digest not found: {digest_id}"},
            })
            return

        metadata = storage.get_metadata(digest_id)
        tree = metadata.get("tree", "") if metadata else ""

        # Generate summary via Claude
        try:
            result = await generate_summary(
                api_key=settings.claude_api_key,
                tree=tree,
                content=digest_content,
                summary_type=summary_type,
            )
        except (ValueError, RuntimeError) as exc:
            logger.exception("AI summary generation failed for digest %s", digest_id)
            yield _format_sse({
                "type": "error",
                "payload": {"message": f"AI generation failed: {exc}"},
            })
            return

        # Cache the result
        try:
            storage.store_summary(digest_id, summary_type.value, result)
            logger.info("Cached %s summary for digest %s", summary_type.value, digest_id)
        except Exception:
            logger.exception("Failed to cache summary for digest %s", digest_id)
            # Non-fatal: still return the result

        # Emit complete event
        yield _format_sse({
            "type": "complete",
            "payload": {
                "summary_type": summary_type.value,
                "content": result,
                "cached": False,
            },
        })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/api/chat/stream")
@limiter.limit("15/minute")
async def api_chat_stream(
    request: Request,
    chat_request: ChatRequest,
) -> StreamingResponse:
    """Stream AI chat response as Server-Sent Events.

    Accepts a user message and optional conversation history,
    retrieves the digest context, and generates a conversational
    response using Claude.

    Parameters
    ----------
    request : Request
        The incoming HTTP request (used by rate limiter).
    chat_request : ChatRequest
        Request body with ``digest_id``, ``message``, and ``history``.

    Returns
    -------
    StreamingResponse
        SSE stream with the chat response.

    """

    async def event_generator() -> AsyncGenerator[str, None]:
        digest_id = chat_request.digest_id
        message = chat_request.message
        history = [{"role": m.role, "content": m.content} for m in chat_request.history]

        # Check API key
        if not settings.claude_api_key:
            yield _format_sse({
                "type": "error",
                "payload": {"message": "AI chat is not configured (missing API key)"},
            })
            return

        storage = get_storage()

        # Emit thinking event
        yield _format_sse({
            "type": "thinking",
            "payload": {"message": "Analyzing repository and thinking..."},
        })

        # Retrieve digest content + metadata
        digest_content = storage.get_digest(digest_id)
        if not digest_content:
            yield _format_sse({
                "type": "error",
                "payload": {"message": f"Digest not found: {digest_id}"},
            })
            return

        metadata = storage.get_metadata(digest_id)
        tree = metadata.get("tree", "") if metadata else ""

        # Generate chat response via Claude
        try:
            result = await generate_chat_response(
                api_key=settings.claude_api_key,
                tree=tree,
                content=digest_content,
                message=message,
                history=history,
            )
        except (ValueError, RuntimeError) as exc:
            logger.exception("AI chat failed for digest %s", digest_id)
            yield _format_sse({
                "type": "error",
                "payload": {"message": f"AI chat failed: {exc}"},
            })
            return

        # Emit complete event with the response
        yield _format_sse({
            "type": "complete",
            "payload": {"content": result},
        })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
