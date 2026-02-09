"""Tests for the AI summary module, chat, and storage integration."""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.ai_summary import (
    MAX_CHAT_CONTEXT_CHARS,
    MAX_CONTENT_CHARS,
    SUMMARY_PROMPTS,
    SummaryType,
    generate_chat_response,
    generate_summary,
)
from storage.local import LocalStorage

if TYPE_CHECKING:
    from pathlib import Path


class TestSummaryType:
    """Tests for the SummaryType enum."""

    def test_all_types_have_prompts(self) -> None:
        """Every SummaryType value should have a corresponding prompt."""
        for st in SummaryType:
            assert st in SUMMARY_PROMPTS, f"Missing prompt for {st}"

    def test_enum_values(self) -> None:
        """SummaryType string values should match expected identifiers."""
        assert SummaryType.ARCHITECTURE.value == "architecture"
        assert SummaryType.CODE_REVIEW.value == "code_review"
        assert SummaryType.ONBOARDING.value == "onboarding"
        assert SummaryType.SECURITY.value == "security"

    def test_enum_count(self) -> None:
        """There should be exactly 4 summary types."""
        assert len(SummaryType) == 4

    def test_prompts_are_nonempty(self) -> None:
        """Every prompt should be a non-empty string."""
        for st, prompt in SUMMARY_PROMPTS.items():
            assert isinstance(prompt, str)
            assert len(prompt) > 50, f"Prompt for {st} is too short"


class TestGenerateSummary:
    """Tests for the generate_summary async function."""

    @pytest.mark.asyncio
    async def test_missing_api_key_raises(self) -> None:
        """Should raise ValueError when API key is empty."""
        with pytest.raises(ValueError, match="not configured"):
            await generate_summary(
                api_key="",
                tree="root/\n  file.py",
                content="print('hello')",
                summary_type=SummaryType.ARCHITECTURE,
            )

    @pytest.mark.asyncio
    async def test_generates_summary_with_mock(self) -> None:
        """Should call Gemini API and return generated text."""
        mock_response = MagicMock()
        mock_response.text = "# Architecture Overview\nThis is a test summary."

        mock_model = MagicMock()
        mock_model.generate_content_async = AsyncMock(return_value=mock_response)

        with patch("core.ai_summary.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model

            result = await generate_summary(
                api_key="fake-key",
                tree="root/\n  main.py",
                content="def main(): pass",
                summary_type=SummaryType.ARCHITECTURE,
            )

        assert "Architecture Overview" in result
        mock_genai.configure.assert_called_once_with(api_key="fake-key")
        mock_genai.GenerativeModel.assert_called_once_with("gemini-2.0-flash")
        mock_model.generate_content_async.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_truncates_large_content(self) -> None:
        """Content exceeding MAX_CONTENT_CHARS should be truncated."""
        large_content = "x" * (MAX_CONTENT_CHARS + 10_000)

        mock_response = MagicMock()
        mock_response.text = "Summary of large repo"

        mock_model = MagicMock()
        mock_model.generate_content_async = AsyncMock(return_value=mock_response)

        with patch("core.ai_summary.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model

            result = await generate_summary(
                api_key="fake-key",
                tree="root/",
                content=large_content,
                summary_type=SummaryType.CODE_REVIEW,
            )

        assert result == "Summary of large repo"
        # Verify the prompt was sent (content should have been truncated)
        call_args = mock_model.generate_content_async.call_args[0][0]
        assert "content truncated" in call_args

    @pytest.mark.asyncio
    async def test_api_error_raises_runtime_error(self) -> None:
        """Should wrap Gemini API errors in RuntimeError."""
        mock_model = MagicMock()
        mock_model.generate_content_async = AsyncMock(side_effect=Exception("API quota exceeded"))

        with patch("core.ai_summary.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model

            with pytest.raises(RuntimeError, match="AI summary generation failed"):
                await generate_summary(
                    api_key="fake-key",
                    tree="root/",
                    content="code",
                    summary_type=SummaryType.SECURITY,
                )


class TestStorageSummary:
    """Tests for summary storage methods in LocalStorage."""

    def test_local_store_and_get(self, tmp_path: Path) -> None:
        """Storing and retrieving a summary should round-trip correctly."""
        storage = LocalStorage(base_path=str(tmp_path))
        storage.store_summary("digest-1", "architecture", "# Architecture\nGreat design!")

        result = storage.get_summary("digest-1", "architecture")
        assert result == "# Architecture\nGreat design!"

    def test_local_get_nonexistent(self, tmp_path: Path) -> None:
        """Getting a non-existent summary should return None."""
        storage = LocalStorage(base_path=str(tmp_path))
        assert storage.get_summary("no-such-digest", "architecture") is None

    def test_local_multiple_types(self, tmp_path: Path) -> None:
        """Different summary types should be stored independently."""
        storage = LocalStorage(base_path=str(tmp_path))
        storage.store_summary("digest-1", "architecture", "Arch content")
        storage.store_summary("digest-1", "code_review", "Review content")

        assert storage.get_summary("digest-1", "architecture") == "Arch content"
        assert storage.get_summary("digest-1", "code_review") == "Review content"
        assert storage.get_summary("digest-1", "onboarding") is None

    def test_local_summary_file_path(self, tmp_path: Path) -> None:
        """Summary files should be stored in the digest directory."""
        storage = LocalStorage(base_path=str(tmp_path))
        storage.store_summary("digest-1", "security", "Security report")

        summary_file = tmp_path / "digest-1" / "summary_security.txt"
        assert summary_file.exists()
        assert summary_file.read_text(encoding="utf-8") == "Security report"


class TestGenerateChatResponse:
    """Tests for the generate_chat_response async function."""

    @pytest.mark.asyncio
    async def test_missing_api_key_raises(self) -> None:
        """Should raise ValueError when API key is empty."""
        with pytest.raises(ValueError, match="not configured"):
            await generate_chat_response(
                api_key="",
                tree="root/",
                content="code",
                message="What does this do?",
            )

    @pytest.mark.asyncio
    async def test_generates_chat_response_no_history(self) -> None:
        """Should call Gemini API and return a chat response without history."""
        mock_response = MagicMock()
        mock_response.text = "This project is a web application."

        mock_model = MagicMock()
        mock_model.generate_content_async = AsyncMock(return_value=mock_response)

        with patch("core.ai_summary.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model

            result = await generate_chat_response(
                api_key="fake-key",
                tree="root/\n  app.py",
                content="from flask import Flask",
                message="What does this project do?",
            )

        assert result == "This project is a web application."
        mock_genai.configure.assert_called_once_with(api_key="fake-key")
        mock_genai.GenerativeModel.assert_called_once_with("gemini-2.0-flash")
        mock_model.generate_content_async.assert_awaited_once()

        # Verify the conversation format (list of dicts with role/parts)
        call_args = mock_model.generate_content_async.call_args[0][0]
        assert isinstance(call_args, list)
        assert len(call_args) == 1
        assert call_args[0]["role"] == "user"

    @pytest.mark.asyncio
    async def test_generates_chat_response_with_history(self) -> None:
        """Should include conversation history in the Gemini API call."""
        mock_response = MagicMock()
        mock_response.text = "The main entry point is app.py."

        mock_model = MagicMock()
        mock_model.generate_content_async = AsyncMock(return_value=mock_response)

        history = [
            {"role": "user", "content": "What does this project do?"},
            {"role": "assistant", "content": "It's a web app."},
        ]

        with patch("core.ai_summary.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model

            result = await generate_chat_response(
                api_key="fake-key",
                tree="root/\n  app.py",
                content="from flask import Flask",
                message="What is the main entry point?",
                history=history,
            )

        assert result == "The main entry point is app.py."
        call_args = mock_model.generate_content_async.call_args[0][0]
        assert isinstance(call_args, list)
        # 2 history messages + 1 current = 3 total
        assert len(call_args) == 3
        assert call_args[0]["role"] == "user"
        assert call_args[1]["role"] == "model"  # assistant -> model for Gemini
        assert call_args[2]["role"] == "user"

    @pytest.mark.asyncio
    async def test_truncates_large_content_for_chat(self) -> None:
        """Content exceeding MAX_CHAT_CONTEXT_CHARS should be truncated."""
        large_content = "x" * (MAX_CHAT_CONTEXT_CHARS + 10_000)

        mock_response = MagicMock()
        mock_response.text = "Chat response about large repo"

        mock_model = MagicMock()
        mock_model.generate_content_async = AsyncMock(return_value=mock_response)

        with patch("core.ai_summary.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model

            result = await generate_chat_response(
                api_key="fake-key",
                tree="root/",
                content=large_content,
                message="Tell me about this repo",
            )

        assert result == "Chat response about large repo"

    @pytest.mark.asyncio
    async def test_api_error_raises_runtime_error(self) -> None:
        """Should wrap Gemini API errors in RuntimeError."""
        mock_model = MagicMock()
        mock_model.generate_content_async = AsyncMock(side_effect=Exception("Rate limited"))

        with patch("core.ai_summary.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model

            with pytest.raises(RuntimeError, match="AI chat failed"):
                await generate_chat_response(
                    api_key="fake-key",
                    tree="root/",
                    content="code",
                    message="What is this?",
                )
