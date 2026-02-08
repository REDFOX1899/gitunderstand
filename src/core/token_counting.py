"""Multi-LLM token counting for repository digests.

Provides token estimates for GPT-4o, Claude, Gemini, and Llama models
using tiktoken encodings and heuristic approximations.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache

import tiktoken

logger = logging.getLogger(__name__)

# Model context window sizes (for reference / chunking)
MODEL_CONTEXT_WINDOWS: dict[str, int] = {
    "GPT-4o": 128_000,
    "Claude": 200_000,
    "Gemini": 2_000_000,
    "Llama 3": 128_000,
}

_TOKEN_THRESHOLDS: list[tuple[int, str]] = [
    (1_000_000, "M"),
    (1_000, "k"),
]


@dataclass(frozen=True)
class TokenEstimate:
    """Token count estimate for a specific model.

    Attributes
    ----------
    model_name : str
        Display name of the model (e.g. "GPT-4o").
    token_count : int
        Estimated token count.
    encoding_name : str
        Name of the encoding or method used for the estimate.

    """

    model_name: str
    token_count: int
    encoding_name: str


@lru_cache(maxsize=4)
def _get_encoding(name: str) -> tiktoken.Encoding:
    """Return a cached tiktoken encoding object."""
    return tiktoken.get_encoding(name)


def _count_tiktoken(text: str, encoding_name: str) -> int:
    """Count tokens using a tiktoken encoding."""
    encoding = _get_encoding(encoding_name)
    return len(encoding.encode(text, disallowed_special=()))


def estimate_tokens(text: str) -> list[TokenEstimate]:
    """Estimate token counts for multiple LLM models.

    Parameters
    ----------
    text : str
        The text to estimate tokens for.

    Returns
    -------
    list[TokenEstimate]
        Token estimates for each supported model.

    """
    estimates: list[TokenEstimate] = []

    # GPT-4o / GPT-4o-mini: tiktoken o200k_base (exact)
    try:
        gpt4o_count = _count_tiktoken(text, "o200k_base")
        estimates.append(TokenEstimate("GPT-4o", gpt4o_count, "o200k_base"))
    except Exception:
        logger.warning("Failed to count GPT-4o tokens")

    # Claude 3.5/4: tiktoken cl100k_base as approximation (~5-10% accurate)
    try:
        claude_count = _count_tiktoken(text, "cl100k_base")
        estimates.append(TokenEstimate("Claude", claude_count, "cl100k_base"))
    except Exception:
        logger.warning("Failed to count Claude tokens")

    # Gemini: character-based estimation (chars / 4 is Google's rough guideline)
    try:
        gemini_count = max(1, len(text) // 4)
        estimates.append(TokenEstimate("Gemini", gemini_count, "chars/4"))
    except Exception:
        logger.warning("Failed to count Gemini tokens")

    # Llama 3: uses similar BPE tokenizer to GPT-4o, o200k_base is a close approximation
    try:
        llama_count = _count_tiktoken(text, "o200k_base")
        estimates.append(TokenEstimate("Llama 3", llama_count, "o200k_base"))
    except Exception:
        logger.warning("Failed to count Llama 3 tokens")

    return estimates


def format_token_count(count: int) -> str:
    """Format a token count as a human-readable string (e.g. ``1.2k``, ``1.2M``).

    Parameters
    ----------
    count : int
        The raw token count.

    Returns
    -------
    str
        The formatted string.

    """
    for threshold, suffix in _TOKEN_THRESHOLDS:
        if count >= threshold:
            return f"{count / threshold:.1f}{suffix}"
    return str(count)


def estimates_to_dict(estimates: list[TokenEstimate]) -> dict[str, int]:
    """Convert a list of token estimates to a simple model_name → count dict.

    Parameters
    ----------
    estimates : list[TokenEstimate]
        The token estimates.

    Returns
    -------
    dict[str, int]
        Mapping of model names to token counts.

    """
    return {e.model_name: e.token_count for e in estimates}
