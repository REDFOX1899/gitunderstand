"""Tests for the progress reporting modules."""

from __future__ import annotations

import asyncio
import json

from api.progress import QueueReporter, format_sse_event
from core.progress import NoOpReporter, ProgressStage


class TestProgressStage:
    """Tests for the ProgressStage enum."""

    def test_has_all_stages(self) -> None:
        """All seven stages should exist."""
        assert ProgressStage.PARSING == "parsing"
        assert ProgressStage.CLONING == "cloning"
        assert ProgressStage.ANALYZING == "analyzing"
        assert ProgressStage.FORMATTING == "formatting"
        assert ProgressStage.STORING == "storing"
        assert ProgressStage.COMPLETE == "complete"
        assert ProgressStage.ERROR == "error"

    def test_stage_count(self) -> None:
        """Should have exactly 7 stages."""
        assert len(ProgressStage) == 7


class TestNoOpReporter:
    """Tests for the NoOpReporter."""

    def test_report_does_nothing(self) -> None:
        """Calling report should not raise."""
        reporter = NoOpReporter()
        reporter.report(ProgressStage.PARSING, {"message": "test"})

    def test_report_with_none_payload(self) -> None:
        """Calling report with None payload should not raise."""
        reporter = NoOpReporter()
        reporter.report(ProgressStage.CLONING)

    def test_report_all_stages(self) -> None:
        """Should accept all stages without error."""
        reporter = NoOpReporter()
        for stage in ProgressStage:
            reporter.report(stage, {"test": True})


class TestQueueReporter:
    """Tests for the QueueReporter."""

    def test_report_puts_event_on_queue(self) -> None:
        """Events should appear on the queue with correct type and payload."""

        async def _run() -> None:
            loop = asyncio.get_running_loop()
            queue: asyncio.Queue[dict] = asyncio.Queue()
            reporter = QueueReporter(queue, loop)

            reporter.report(ProgressStage.CLONING, {"repo_url": "https://github.com/test/repo"})

            event = await asyncio.wait_for(queue.get(), timeout=1.0)
            assert event["type"] == "cloning"
            assert event["payload"]["repo_url"] == "https://github.com/test/repo"

        asyncio.run(_run())

    def test_report_with_no_payload(self) -> None:
        """Report with no payload should produce empty dict payload."""

        async def _run() -> None:
            loop = asyncio.get_running_loop()
            queue: asyncio.Queue[dict] = asyncio.Queue()
            reporter = QueueReporter(queue, loop)

            reporter.report(ProgressStage.PARSING)

            event = await asyncio.wait_for(queue.get(), timeout=1.0)
            assert event["type"] == "parsing"
            assert event["payload"] == {}

        asyncio.run(_run())

    def test_multiple_events_in_order(self) -> None:
        """Events should arrive in FIFO order."""

        async def _run() -> None:
            loop = asyncio.get_running_loop()
            queue: asyncio.Queue[dict] = asyncio.Queue()
            reporter = QueueReporter(queue, loop)

            reporter.report(ProgressStage.PARSING, {"step": 1})
            reporter.report(ProgressStage.CLONING, {"step": 2})
            reporter.report(ProgressStage.ANALYZING, {"step": 3})

            e1 = await asyncio.wait_for(queue.get(), timeout=1.0)
            e2 = await asyncio.wait_for(queue.get(), timeout=1.0)
            e3 = await asyncio.wait_for(queue.get(), timeout=1.0)

            assert e1["type"] == "parsing"
            assert e2["type"] == "cloning"
            assert e3["type"] == "analyzing"

        asyncio.run(_run())


class TestFormatSSE:
    """Tests for the format_sse_event function."""

    def test_format_sse_event_structure(self) -> None:
        """Output should be 'data: {json}\\n\\n'."""
        event = {"type": "parsing", "payload": {"message": "test"}}
        result = format_sse_event(event)

        assert result.startswith("data: ")
        assert result.endswith("\n\n")

    def test_format_sse_event_valid_json(self) -> None:
        """The JSON portion should be valid."""
        event = {"type": "complete", "payload": {"summary": "hello"}}
        result = format_sse_event(event)

        json_str = result.removeprefix("data: ").rstrip("\n")
        parsed = json.loads(json_str)
        assert parsed["type"] == "complete"
        assert parsed["payload"]["summary"] == "hello"

    def test_format_sse_event_empty_payload(self) -> None:
        """Empty payload should produce valid SSE."""
        event = {"type": "error", "payload": {}}
        result = format_sse_event(event)

        assert '"payload": {}' in result
