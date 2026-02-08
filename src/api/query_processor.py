"""Process a query by parsing input, cloning a repository, and generating a summary."""

from __future__ import annotations

import asyncio
import logging
import shutil
from pathlib import Path
from typing import TYPE_CHECKING, cast

from api.config import get_settings
from api.models import IngestErrorResponse, IngestResponse, IngestSuccessResponse, PatternType
from core.clone import clone_repo
from core.ingestion import ingest_query
from core.output_formats import OutputFormat
from core.parser import parse_remote_repo
from core.utils.git_utils import validate_github_token
from core.utils.pattern_utils import process_patterns
from storage.factory import get_storage

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from core.progress import ProgressReporter
    from core.schemas.cloning import CloneConfig
    from core.schemas.ingestion import IngestionQuery

settings = get_settings()
MAX_DISPLAY_SIZE: int = 300_000


def _cleanup_repository(clone_config: CloneConfig) -> None:
    """Clean up the cloned repository after processing."""
    try:
        local_path = Path(clone_config.local_path)
        if local_path.exists():
            shutil.rmtree(local_path)
            logger.info("Successfully cleaned up repository at %s", local_path)
    except (PermissionError, OSError):
        logger.exception("Could not delete repository at %s", clone_config.local_path)


def _store_digest(
    query: IngestionQuery,
    clone_config: CloneConfig,
    digest_content: str,
    summary: str,
    tree: str,
    content: str,
) -> str:
    """Store digest content using the configured storage backend.

    Uses the storage factory to select either local filesystem or GCS
    based on application settings.

    Parameters
    ----------
    query : IngestionQuery
        The query object containing repository information.
    clone_config : CloneConfig
        The clone configuration object.
    digest_content : str
        The complete digest content to store.
    summary : str
        The summary content for metadata.
    tree : str
        The tree content for metadata.
    content : str
        The file content for metadata.

    Returns
    -------
    str
        The download URL for the stored digest.

    """
    storage = get_storage()
    digest_id = str(query.id)

    storage.store_digest(
        digest_id=digest_id,
        content=digest_content,
        metadata={
            "summary": summary,
            "tree": tree,
            "content": content,
            "repo_url": str(query.url),
            "user_name": query.user_name,
            "repo_name": query.repo_name,
        },
    )

    return f"/api/download/file/{query.id}"


async def process_query(
    input_text: str,
    max_file_size: int,
    pattern_type: PatternType,
    pattern: str,
    token: str | None = None,
    output_format: OutputFormat = OutputFormat.TEXT,
) -> IngestResponse:
    """Process a query by parsing input, cloning a repository, and generating a summary.

    Handle user input, process Git repository data, and prepare
    a response for rendering a template with the processed results or an error message.

    Parameters
    ----------
    input_text : str
        Input text provided by the user, typically a Git repository URL or slug.
    max_file_size : int
        Max file size in KB to be included in the digest.
    pattern_type : PatternType
        Type of pattern to use (either "include" or "exclude").
    pattern : str
        Pattern to include or exclude in the query, depending on the pattern type.
    token : str | None
        GitHub personal access token (PAT) for accessing private repositories.
    output_format : OutputFormat
        Desired output format (text, json, markdown, xml).

    Returns
    -------
    IngestResponse
        A union type, corresponding to IngestErrorResponse or IngestSuccessResponse.

    """
    if token:
        validate_github_token(token)

    try:
        query = await parse_remote_repo(input_text, token=token)
    except Exception as exc:
        logger.warning("Failed to parse remote repository: %s (input: %s)", exc, input_text)
        return IngestErrorResponse(error=str(exc))

    query.url = cast("str", query.url)
    query.max_file_size = max_file_size * 1024  # Convert KB to bytes

    query.ignore_patterns, query.include_patterns = process_patterns(
        exclude_patterns=pattern if pattern_type == PatternType.EXCLUDE else None,
        include_patterns=pattern if pattern_type == PatternType.INCLUDE else None,
    )

    clone_config = query.extract_clone_config()
    await clone_repo(clone_config, token=token)

    short_repo_url = f"{query.user_name}/{query.repo_name}"

    try:
        summary, tree, content, token_counts = ingest_query(query)
        digest_content = tree + "\n" + content
        digest_url = _store_digest(query, clone_config, digest_content, summary, tree, content)
    except Exception as exc:
        logger.error(
            "Query processing failed for %s: %s",
            query.url,
            exc,
        )
        _cleanup_repository(clone_config)
        return IngestErrorResponse(error=f"{exc!s}")

    if len(content) > MAX_DISPLAY_SIZE:
        content = (
            f"(Files content cropped to {int(MAX_DISPLAY_SIZE / 1_000)}k characters, "
            "download full ingest to see more)\n" + content[:MAX_DISPLAY_SIZE]
        )

    logger.info("Query processing completed for %s", query.url)

    _cleanup_repository(clone_config)

    return IngestSuccessResponse(
        repo_url=input_text,
        short_repo_url=short_repo_url,
        summary=summary,
        digest_url=digest_url,
        tree=tree,
        content=content,
        default_max_file_size=max_file_size,
        pattern_type=pattern_type,
        pattern=pattern,
        token_counts=token_counts,
        output_format=output_format.value,
    )


async def process_query_streaming(
    input_text: str,
    max_file_size: int,
    pattern_type: PatternType,
    pattern: str,
    token: str | None = None,
    output_format: OutputFormat = OutputFormat.TEXT,
    reporter: ProgressReporter | None = None,
) -> IngestResponse:
    """Process a query with SSE progress reporting.

    Same pipeline as ``process_query`` but emits progress events at each stage
    via the reporter. The synchronous ``ingest_query`` call is wrapped in
    ``asyncio.to_thread()`` so the event loop remains responsive for SSE delivery.

    Parameters
    ----------
    input_text : str
        Input text provided by the user, typically a Git repository URL or slug.
    max_file_size : int
        Max file size in KB to be included in the digest.
    pattern_type : PatternType
        Type of pattern to use (either "include" or "exclude").
    pattern : str
        Pattern to include or exclude in the query, depending on the pattern type.
    token : str | None
        GitHub personal access token (PAT) for accessing private repositories.
    output_format : OutputFormat
        Desired output format (text, json, markdown, xml).
    reporter : ProgressReporter | None
        Progress reporter for SSE streaming events.

    Returns
    -------
    IngestResponse
        A union type, corresponding to IngestErrorResponse or IngestSuccessResponse.

    """
    from core.progress import ProgressStage

    if token:
        validate_github_token(token)

    # Stage: Parsing
    if reporter:
        reporter.report(ProgressStage.PARSING, {"message": "Parsing repository URL..."})

    try:
        query = await parse_remote_repo(input_text, token=token)
    except Exception as exc:
        logger.warning("Failed to parse remote repository: %s (input: %s)", exc, input_text)
        if reporter:
            reporter.report(ProgressStage.ERROR, {"error": str(exc)})
        return IngestErrorResponse(error=str(exc))

    query.url = cast("str", query.url)
    query.max_file_size = max_file_size * 1024

    query.ignore_patterns, query.include_patterns = process_patterns(
        exclude_patterns=pattern if pattern_type == PatternType.EXCLUDE else None,
        include_patterns=pattern if pattern_type == PatternType.INCLUDE else None,
    )

    clone_config = query.extract_clone_config()

    # Stage: Cloning
    if reporter:
        reporter.report(ProgressStage.CLONING, {"message": "Cloning repository...", "repo_url": input_text})

    try:
        await clone_repo(clone_config, token=token)
    except Exception as exc:
        logger.error("Clone failed for %s: %s", input_text, exc)
        if reporter:
            reporter.report(ProgressStage.ERROR, {"error": f"Clone failed: {exc!s}"})
        return IngestErrorResponse(error=f"Clone failed: {exc!s}")

    short_repo_url = f"{query.user_name}/{query.repo_name}"

    try:
        # Run synchronous ingest_query in a worker thread so the event loop
        # remains responsive and can push SSE events from the Queue.
        summary, tree, content, token_counts = await asyncio.to_thread(ingest_query, query, reporter)

        # Stage: Storing
        if reporter:
            reporter.report(ProgressStage.STORING, {"message": "Saving digest..."})

        digest_content = tree + "\n" + content
        digest_url = _store_digest(query, clone_config, digest_content, summary, tree, content)
    except Exception as exc:
        logger.error("Query processing failed for %s: %s", query.url, exc)
        if reporter:
            reporter.report(ProgressStage.ERROR, {"error": f"{exc!s}"})
        _cleanup_repository(clone_config)
        return IngestErrorResponse(error=f"{exc!s}")

    if len(content) > MAX_DISPLAY_SIZE:
        content = (
            f"(Files content cropped to {int(MAX_DISPLAY_SIZE / 1_000)}k characters, "
            "download full ingest to see more)\n" + content[:MAX_DISPLAY_SIZE]
        )

    logger.info("Streaming query processing completed for %s", query.url)

    _cleanup_repository(clone_config)

    result = IngestSuccessResponse(
        repo_url=input_text,
        short_repo_url=short_repo_url,
        summary=summary,
        digest_url=digest_url,
        tree=tree,
        content=content,
        default_max_file_size=max_file_size,
        pattern_type=pattern_type,
        pattern=pattern,
        token_counts=token_counts,
        output_format=output_format.value,
    )

    # Stage: Complete
    if reporter:
        reporter.report(ProgressStage.COMPLETE, result.model_dump())

    return result
