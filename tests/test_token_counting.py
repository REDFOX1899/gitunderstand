"""Tests for the multi-LLM token counting module."""

from __future__ import annotations

from core.token_counting import (
    TokenEstimate,
    estimate_tokens,
    estimates_to_dict,
    format_token_count,
)


class TestEstimateTokens:
    """Tests for estimate_tokens function."""

    def test_returns_estimates_for_all_models(self) -> None:
        """All four models should produce estimates."""
        text = "Hello world, this is a test string for token counting."
        estimates = estimate_tokens(text)

        model_names = {e.model_name for e in estimates}
        assert "GPT-4o" in model_names
        assert "Claude" in model_names
        assert "Gemini" in model_names
        assert "Llama 3" in model_names

    def test_returns_positive_counts(self) -> None:
        """Token counts should be positive for non-empty text."""
        text = "Hello world"
        estimates = estimate_tokens(text)

        for estimate in estimates:
            assert estimate.token_count > 0

    def test_empty_string(self) -> None:
        """Empty string should return zero or near-zero counts."""
        estimates = estimate_tokens("")

        for estimate in estimates:
            assert estimate.token_count >= 0

    def test_long_text_produces_larger_counts(self) -> None:
        """Longer text should produce more tokens."""
        short = "Hello"
        long_text = "Hello world " * 1000

        short_estimates = estimate_tokens(short)
        long_estimates = estimate_tokens(long_text)

        short_gpt = next(e for e in short_estimates if e.model_name == "GPT-4o")
        long_gpt = next(e for e in long_estimates if e.model_name == "GPT-4o")

        assert long_gpt.token_count > short_gpt.token_count

    def test_estimate_has_encoding_name(self) -> None:
        """Each estimate should have an encoding_name set."""
        estimates = estimate_tokens("test")

        for estimate in estimates:
            assert estimate.encoding_name
            assert isinstance(estimate.encoding_name, str)

    def test_gemini_uses_char_based_estimation(self) -> None:
        """Gemini estimate should use chars/4 method."""
        text = "a" * 400
        estimates = estimate_tokens(text)
        gemini = next(e for e in estimates if e.model_name == "Gemini")

        assert gemini.encoding_name == "chars/4"
        assert gemini.token_count == 100  # 400 / 4


class TestFormatTokenCount:
    """Tests for format_token_count function."""

    def test_small_number(self) -> None:
        """Numbers below 1000 should be returned as-is."""
        assert format_token_count(42) == "42"
        assert format_token_count(999) == "999"

    def test_thousands(self) -> None:
        """Numbers in thousands should use 'k' suffix."""
        assert format_token_count(1000) == "1.0k"
        assert format_token_count(1500) == "1.5k"
        assert format_token_count(50_000) == "50.0k"

    def test_millions(self) -> None:
        """Numbers in millions should use 'M' suffix."""
        assert format_token_count(1_000_000) == "1.0M"
        assert format_token_count(2_500_000) == "2.5M"

    def test_zero(self) -> None:
        """Zero should be returned as '0'."""
        assert format_token_count(0) == "0"


class TestEstimatesToDict:
    """Tests for estimates_to_dict function."""

    def test_converts_to_dict(self) -> None:
        """Should convert list of estimates to a dict."""
        estimates = [
            TokenEstimate("GPT-4o", 100, "o200k_base"),
            TokenEstimate("Claude", 110, "cl100k_base"),
        ]
        result = estimates_to_dict(estimates)

        assert result == {"GPT-4o": 100, "Claude": 110}

    def test_empty_list(self) -> None:
        """Empty list should return empty dict."""
        assert estimates_to_dict([]) == {}

    def test_preserves_all_entries(self) -> None:
        """All estimates should be present in the dict."""
        estimates = estimate_tokens("Hello world")
        result = estimates_to_dict(estimates)

        assert len(result) == len(estimates)
        for estimate in estimates:
            assert estimate.model_name in result
            assert result[estimate.model_name] == estimate.token_count
