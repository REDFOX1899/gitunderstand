"""Ingest endpoints for the GitUnderstand API."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse

from api.config import get_settings
from api.middleware import limiter
from api.models import IngestErrorResponse, IngestRequest, IngestSuccessResponse, PatternType
from api.progress import QueueReporter, format_sse_event
from api.query_processor import process_query, process_query_streaming
from api.shared import templates
from core.output_formats import OutputFormat
from core.progress import ProgressStage

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator
    from uuid import UUID

logger = logging.getLogger(__name__)

settings = get_settings()
router = APIRouter()

COMMON_INGEST_RESPONSES: dict[int | str, dict[str, Any]] = {
    status.HTTP_200_OK: {"model": IngestSuccessResponse, "description": "Successful ingestion"},
    status.HTTP_400_BAD_REQUEST: {"model": IngestErrorResponse, "description": "Bad request or processing error"},
    status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": IngestErrorResponse, "description": "Internal server error"},
}


async def _perform_ingestion(
    input_text: str,
    max_file_size: int,
    pattern_type: str,
    pattern: str,
    token: str | None,
    output_format: OutputFormat = OutputFormat.TEXT,
) -> JSONResponse:
    """Run ``process_query`` and wrap the result in a JSONResponse.

    Consolidates error handling shared by the POST and GET ingest endpoints.

    Parameters
    ----------
    input_text : str
        The Git repository URL or slug.
    max_file_size : int
        Maximum file size in KB.
    pattern_type : str
        Pattern type (include or exclude).
    pattern : str
        Pattern string.
    token : str | None
        GitHub PAT for private repositories.
    output_format : OutputFormat
        Desired output format (text, json, markdown, xml).

    Returns
    -------
    JSONResponse
        The API response.

    """
    try:
        pt = PatternType(pattern_type)

        result = await process_query(
            input_text=input_text,
            max_file_size=max_file_size,
            pattern_type=pt,
            pattern=pattern,
            token=token,
            output_format=output_format,
        )

        if isinstance(result, IngestErrorResponse):
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=result.model_dump())

        return JSONResponse(status_code=status.HTTP_200_OK, content=result.model_dump())

    except ValueError as ve:
        error_response = IngestErrorResponse(error=f"Validation error: {ve!s}")
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=error_response.model_dump())

    except Exception as exc:
        error_response = IngestErrorResponse(error=f"Internal server error: {exc!s}")
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=error_response.model_dump())


@router.get("/{user}/{repository}", response_class=HTMLResponse, include_in_schema=False)
async def ingest_page(
    request: Request,
    user: str,
    repository: str,
) -> HTMLResponse:
    """Render the ingest page with a GitHub repo URL pre-filled.

    The frontend JS auto-submits the form on page load when a URL is present.

    Parameters
    ----------
    request : Request
        The incoming HTTP request.
    user : str
        GitHub username or organization.
    repository : str
        GitHub repository name.

    Returns
    -------
    HTMLResponse
        The rendered ingest page.

    """
    repo_url = f"https://github.com/{user}/{repository}"
    context = {
        "request": request,
        "repo_url": repo_url,
        "default_max_file_size": settings.default_file_size_kb,
    }
    return templates.TemplateResponse("ingest.html", context)


@router.post("/api/ingest", responses=COMMON_INGEST_RESPONSES)
@limiter.limit("10/minute")
async def api_ingest(
    request: Request,
    ingest_request: IngestRequest,
) -> JSONResponse:
    """Ingest a Git repository and return processed content.

    This endpoint processes a Git repository by cloning it, analyzing its structure,
    and returning a summary with the repository's content.

    Parameters
    ----------
    request : Request
        The incoming HTTP request (used by rate limiter).
    ingest_request : IngestRequest
        Pydantic model containing ingestion parameters.

    Returns
    -------
    JSONResponse
        Success response with ingestion results or error response.

    """
    return await _perform_ingestion(
        input_text=ingest_request.input_text,
        max_file_size=ingest_request.max_file_size,
        pattern_type=ingest_request.pattern_type.value,
        pattern=ingest_request.pattern,
        token=ingest_request.token,
        output_format=ingest_request.output_format,
    )


@router.post("/api/ingest/stream")
@limiter.limit("10/minute")
async def api_ingest_stream(
    request: Request,
    ingest_request: IngestRequest,
) -> StreamingResponse:
    """Stream ingestion progress as Server-Sent Events.

    Returns a ``text/event-stream`` response that emits progress events
    during repository cloning, file analysis, and output generation.
    The final event of type ``complete`` contains the full ingestion result.

    Parameters
    ----------
    request : Request
        The incoming HTTP request (used by rate limiter).
    ingest_request : IngestRequest
        Pydantic model containing ingestion parameters.

    Returns
    -------
    StreamingResponse
        SSE stream with progress events.

    """

    async def event_generator() -> AsyncGenerator[str, None]:
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        reporter = QueueReporter(queue, loop)

        try:
            pt = PatternType(ingest_request.pattern_type.value)
        except ValueError:
            yield format_sse_event({
                "type": ProgressStage.ERROR.value,
                "payload": {"error": f"Invalid pattern_type: {ingest_request.pattern_type}"},
            })
            return

        task = asyncio.create_task(
            process_query_streaming(
                input_text=ingest_request.input_text,
                max_file_size=ingest_request.max_file_size,
                pattern_type=pt,
                pattern=ingest_request.pattern,
                token=ingest_request.token,
                output_format=ingest_request.output_format,
                reporter=reporter,
            )
        )

        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=0.5)
                    yield format_sse_event(event)

                    if event.get("type") in (ProgressStage.COMPLETE.value, ProgressStage.ERROR.value):
                        break
                except TimeoutError:
                    if task.done():
                        # Drain any remaining events
                        while not queue.empty():
                            event = queue.get_nowait()
                            yield format_sse_event(event)
                        break
        except asyncio.CancelledError:
            task.cancel()
            raise
        finally:
            if not task.done():
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError, Exception):  # noqa: BLE001
                    await task

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/api/{user}/{repository}", responses=COMMON_INGEST_RESPONSES)
@limiter.limit("10/minute")
async def api_ingest_get(
    request: Request,
    user: str,
    repository: str,
    max_file_size: int = settings.default_file_size_kb,
    pattern_type: str = "exclude",
    pattern: str = "",
    token: str = "",
) -> JSONResponse:
    """Ingest a GitHub repository via GET and return processed content.

    Path Parameters
    ----------------
    user : str
        GitHub username or organization.
    repository : str
        GitHub repository name.

    Query Parameters
    ----------------
    max_file_size : int
        Maximum file size in KB to include (default: 5120 KB).
    pattern_type : str
        Type of pattern to use (default: "exclude").
    pattern : str
        Pattern to include or exclude (default: "").
    token : str
        GitHub PAT for private repositories (default: "").

    Returns
    -------
    JSONResponse
        Success response with ingestion results or error response.

    """
    return await _perform_ingestion(
        input_text=f"{user}/{repository}",
        max_file_size=max_file_size,
        pattern_type=pattern_type,
        pattern=pattern,
        token=token or None,
    )


@router.get("/api/download/file/{ingest_id}", response_model=None)
async def download_ingest(
    ingest_id: UUID,
) -> FileResponse | JSONResponse:  # noqa: FA100
    """Download the text file produced for an ingest ID.

    Parameters
    ----------
    ingest_id : UUID
        Identifier that the ingest step emitted.

    Returns
    -------
    FileResponse
        Streamed response with media type ``text/plain``.

    Raises
    ------
    HTTPException
        404 if digest directory is missing or contains no ``.txt`` file.
        403 if there is a permission error reading the file.

    """
    tmp_base = Path(settings.local_storage_path)
    directory = (tmp_base / str(ingest_id)).resolve()

    if not str(directory).startswith(str(tmp_base.resolve())):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Invalid ingest ID: {ingest_id!r}")

    if not directory.is_dir():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Digest {ingest_id!r} not found")

    try:
        first_txt_file = next(directory.glob("*.txt"))
    except StopIteration as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No .txt file found for digest {ingest_id!r}",
        ) from exc

    try:
        return FileResponse(path=first_txt_file, media_type="text/plain", filename=first_txt_file.name)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied for {first_txt_file}",
        ) from exc
