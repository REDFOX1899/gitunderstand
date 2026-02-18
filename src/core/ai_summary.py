"""AI-powered repository summary generation using Google Gemini."""

from __future__ import annotations

import asyncio
import logging
from enum import StrEnum

from google import genai
from google.genai import types as genai_types

logger = logging.getLogger(__name__)

# Retry configuration for rate-limit errors
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2  # seconds

# Maximum characters to send to Gemini (leave room for prompt within context)
# ~4 chars per token; 100K token budget leaves room for tree/prompt/response
MAX_CONTENT_CHARS = 400_000

# Maximum characters for chat context (smaller to leave room for conversation history)
MAX_CHAT_CONTEXT_CHARS = 200_000

# Default model for AI generation
DEFAULT_MODEL = "gemini-2.5-flash"


class SummaryType(StrEnum):
    """Types of AI-generated repository summaries."""

    ARCHITECTURE = "architecture"
    CODE_REVIEW = "code_review"
    ONBOARDING = "onboarding"
    SECURITY = "security"


SUMMARY_TYPE_LABELS: dict[SummaryType, str] = {
    SummaryType.ARCHITECTURE: "Architecture Overview",
    SummaryType.CODE_REVIEW: "Code Review",
    SummaryType.ONBOARDING: "Onboarding Guide",
    SummaryType.SECURITY: "Security Audit",
}


SUMMARY_PROMPTS: dict[SummaryType, str] = {
    SummaryType.ARCHITECTURE: (
        "Analyze this repository and provide an Architecture Overview:\n"
        "- High-level system components and their responsibilities\n"
        "- Data flow between components\n"
        "- Design patterns used (MVC, pub-sub, etc.)\n"
        "- Key dependencies and their roles\n"
        "- Entry points and initialization flow\n"
        "Format as structured markdown with clear headings."
    ),
    SummaryType.CODE_REVIEW: (
        "Perform a Code Review of this repository:\n"
        "- Code quality issues and anti-patterns\n"
        "- Potential bugs or error-prone areas\n"
        "- Missing error handling or edge cases\n"
        "- Suggestions for improvement with specific file references\n"
        "- Adherence to language conventions\n"
        "Format as structured markdown with severity levels (Critical/Warning/Info)."
    ),
    SummaryType.ONBOARDING: (
        "Create an Onboarding Guide for a new developer joining this project:\n"
        "- Project purpose and what it does (1-2 sentences)\n"
        "- How to set up the development environment\n"
        "- Key directories and what they contain\n"
        "- Important files to read first\n"
        "- How to run, test, and deploy\n"
        "- Common workflows and patterns used\n"
        "Format as a friendly, structured markdown guide."
    ),
    SummaryType.SECURITY: (
        "Perform a Security Audit of this repository:\n"
        "- Potential security vulnerabilities\n"
        "- Hardcoded secrets or credentials\n"
        "- Input validation issues\n"
        "- Authentication/authorization concerns\n"
        "- Dependency vulnerabilities (based on imports)\n"
        "- Recommendations with priority levels\n"
        "Format as structured markdown with severity (Critical/High/Medium/Low)."
    ),
}


async def generate_summary(
    api_key: str,
    tree: str,
    content: str,
    summary_type: SummaryType,
) -> str:
    """Generate an AI summary of a repository using Google Gemini.

    Parameters
    ----------
    api_key : str
        User's Gemini API key.
    tree : str
        The directory tree structure of the repository.
    content : str
        The concatenated file contents of the repository.
    summary_type : SummaryType
        The type of summary to generate.

    Returns
    -------
    str
        The generated summary in markdown format.

    Raises
    ------
    ValueError
        If the API key is empty.
    RuntimeError
        If the Gemini API call fails.

    """
    if not api_key:
        msg = "A Gemini API key is required. Please set your API key in settings."
        raise ValueError(msg)

    # Truncate content if too large
    if len(content) > MAX_CONTENT_CHARS:
        content = content[:MAX_CONTENT_CHARS] + "\n\n... (content truncated for context limit)"
        logger.info("Truncated content from %d to %d chars", len(content), MAX_CONTENT_CHARS)

    # Build the system prompt
    type_label = SUMMARY_TYPE_LABELS.get(summary_type, summary_type.value)
    system_prompt = (
        "You are an expert software engineer analyzing a code repository.\n"
        f"Generate a {type_label} for this repository.\n\n"
        f"{SUMMARY_PROMPTS[summary_type]}"
    )

    # User message contains the actual repository content
    user_content = (
        f"## Directory Structure\n```\n{tree}\n```\n\n"
        f"## File Contents\n{content}"
    )

    client = genai.Client(api_key=api_key)
    last_exc: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=DEFAULT_MODEL,
                contents=user_content,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=8192,
                    temperature=0,
                ),
            )
            result = response.text
            logger.info("Generated %s summary (%d chars)", summary_type.value, len(result))
            return result
        except Exception as exc:
            exc_str = str(exc).lower()
            if "rate" in exc_str and "limit" in exc_str or "429" in exc_str or "resource" in exc_str:
                last_exc = exc
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    "Rate limited (attempt %d/%d) for summary_type=%s, retrying in %ds",
                    attempt + 1, MAX_RETRIES, summary_type.value, delay,
                )
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(delay)
                continue
            logger.exception("Gemini API call failed for summary_type=%s", summary_type.value)
            msg = f"AI summary generation failed: {exc}"
            raise RuntimeError(msg) from exc

    # All retries exhausted for rate limiting
    msg = "Rate limit exceeded. Please wait a minute before trying again."
    raise RuntimeError(msg) from last_exc


async def generate_chat_response(
    api_key: str,
    tree: str,
    content: str,
    message: str,
    history: list[dict[str, str]] | None = None,
) -> str:
    """Generate a conversational AI response about a repository.

    Parameters
    ----------
    api_key : str
        User's Gemini API key.
    tree : str
        The directory tree structure of the repository.
    content : str
        The concatenated file contents of the repository.
    message : str
        The user's question or message.
    history : list[dict[str, str]] | None
        Previous conversation history as a list of ``{"role": ..., "content": ...}``
        dicts.  Roles are ``"user"`` and ``"assistant"``.

    Returns
    -------
    str
        The AI's response in markdown format.

    Raises
    ------
    ValueError
        If the API key is empty.
    RuntimeError
        If the Gemini API call fails.

    """
    if not api_key:
        msg = "A Gemini API key is required. Please set your API key in settings."
        raise ValueError(msg)

    # Truncate content if too large (smaller limit for chat to leave room for history)
    if len(content) > MAX_CHAT_CONTEXT_CHARS:
        content = content[:MAX_CHAT_CONTEXT_CHARS] + "\n\n... (content truncated for context limit)"
        logger.info("Truncated chat context to %d chars", MAX_CHAT_CONTEXT_CHARS)

    # Build the system prompt with repository context
    system_prompt = (
        "You are an expert software engineer acting as a helpful AI assistant "
        "that has deep knowledge of a specific code repository. You can answer "
        "questions about the code, architecture, bugs, best practices, and anything "
        "else related to this codebase.\n\n"
        "Be concise but thorough. Use markdown formatting. When referencing code, "
        "mention specific file paths. If you're unsure about something, say so.\n\n"
        f"## Directory Structure\n```\n{tree}\n```\n\n"
        f"## File Contents\n{content}"
    )

    # Build contents list — Gemini uses "user"/"model" roles
    contents: list[genai_types.Content] = []
    if history:
        for msg_item in history:
            role = "model" if msg_item["role"] == "assistant" else "user"
            contents.append(genai_types.Content(
                role=role,
                parts=[genai_types.Part(text=msg_item["content"])],
            ))
    contents.append(genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=message)],
    ))

    client = genai.Client(api_key=api_key)
    last_exc: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=DEFAULT_MODEL,
                contents=contents,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=4096,
                    temperature=0,
                ),
            )
            result = response.text
            logger.info("Generated chat response (%d chars)", len(result))
            return result
        except Exception as exc:
            exc_str = str(exc).lower()
            if "rate" in exc_str and "limit" in exc_str or "429" in exc_str or "resource" in exc_str:
                last_exc = exc
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    "Rate limited (attempt %d/%d) for chat, retrying in %ds",
                    attempt + 1, MAX_RETRIES, delay,
                )
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(delay)
                continue
            logger.exception("Gemini chat API call failed")
            msg = f"AI chat failed: {exc}"
            raise RuntimeError(msg) from exc

    # All retries exhausted for rate limiting
    msg = "Rate limit exceeded. Please wait a minute before trying again."
    raise RuntimeError(msg) from last_exc
