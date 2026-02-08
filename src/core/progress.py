"""Progress reporting protocol for SSE streaming.

Defines the shared types used by both the core ingestion pipeline
and the API layer to report progress during long-running operations.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any, Protocol


class ProgressStage(StrEnum):
    """Stages of the ingestion pipeline."""

    PARSING = "parsing"
    CLONING = "cloning"
    ANALYZING = "analyzing"
    FORMATTING = "formatting"
    STORING = "storing"
    COMPLETE = "complete"
    ERROR = "error"


class ProgressReporter(Protocol):
    """Protocol for reporting progress from sync or async pipeline stages.

    Implementations must be safe to call from any thread context,
    since the ingestion pipeline runs synchronously in a worker thread.
    """

    def report(self, stage: ProgressStage, payload: dict[str, Any] | None = None) -> None:
        """Report a progress event.

        Parameters
        ----------
        stage : ProgressStage
            The current pipeline stage.
        payload : dict[str, Any] | None
            Optional payload data for the event.

        """
        ...


class NoOpReporter:
    """Default reporter that does nothing.

    Used by the non-streaming ``/api/ingest`` endpoint for zero overhead.
    """

    def report(self, stage: ProgressStage, payload: dict[str, Any] | None = None) -> None:  # noqa: ARG002
        """Do nothing."""
