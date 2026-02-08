"""Queue-based progress reporter and SSE event formatting for the API layer.

The ``QueueReporter`` bridges synchronous ingestion code (running in a
worker thread via ``asyncio.to_thread``) with the async SSE event generator
using ``loop.call_soon_threadsafe`` to push events onto an ``asyncio.Queue``.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import asyncio

    from core.progress import ProgressStage


class QueueReporter:
    """Reporter that puts events onto an ``asyncio.Queue`` for the SSE generator.

    Because ``ingest_query()`` is synchronous and runs in ``asyncio.to_thread()``,
    we use ``loop.call_soon_threadsafe()`` to push events from the worker thread
    into the asyncio event loop's queue.

    Parameters
    ----------
    queue : asyncio.Queue[dict[str, Any]]
        The queue to push events onto.
    loop : asyncio.AbstractEventLoop
        The running event loop (used for thread-safe puts).

    """

    def __init__(self, queue: asyncio.Queue[dict[str, Any]], loop: asyncio.AbstractEventLoop) -> None:
        self._queue = queue
        self._loop = loop

    def report(self, stage: ProgressStage, payload: dict[str, Any] | None = None) -> None:
        """Push a progress event onto the queue (thread-safe).

        Parameters
        ----------
        stage : ProgressStage
            The current pipeline stage.
        payload : dict[str, Any] | None
            Optional payload data for the event.

        """
        event = {"type": stage.value, "payload": payload or {}}
        self._loop.call_soon_threadsafe(self._queue.put_nowait, event)


def format_sse_event(event: dict[str, Any]) -> str:
    """Format a dict as an SSE ``data:`` line.

    Parameters
    ----------
    event : dict[str, Any]
        The event data to serialize.

    Returns
    -------
    str
        An SSE-formatted string: ``data: {json}\\n\\n``

    """
    return f"data: {json.dumps(event)}\n\n"
