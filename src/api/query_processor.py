"""Process a query by parsing input, cloning a repository, and generating a summary."""

from __future__ import annotations

import logging
import shutil
from pathlib import Path
from typing import TYPE_CHECKING, cast

from api.config import get_settings
from api.models import IngestErrorResponse, IngestResponse, IngestSuccessResponse, PatternType
from core.clone import clone_repo
from core.ingestion import ingest_query
from core.parser import parse_remote_repo
from core.utils.git_utils import validate_github_token
from core.utils.pattern_utils import process_patterns
from storage.local import LocalStorage

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
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


def _store_digest_locally(
    query: IngestionQuery,
    clone_config: CloneConfig,
    digest_content: str,
    summary: str,
    tree: str,
    content: str,
) -> str:
    """Store digest content to local storage.

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
    storage = LocalStorage(base_path=settings.local_storage_path)
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
        summary, tree, content = ingest_query(query)
        digest_content = tree + "\n" + content
        digest_url = _store_digest_locally(query, clone_config, digest_content, summary, tree, content)
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
    )
