"""AI-powered repository summary generation using Anthropic Claude."""

from __future__ import annotations

import logging
from enum import StrEnum

import anthropic

logger = logging.getLogger(__name__)

# Maximum characters to send to Claude (leave room for prompt within 200K context)
MAX_CONTENT_CHARS = 1_500_000

# Maximum characters for chat context (smaller to leave room for conversation history)
MAX_CHAT_CONTEXT_CHARS = 500_000

# Default model for AI generation
DEFAULT_MODEL = "claude-sonnet-4-20250514"


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
    """Generate an AI summary of a repository using Anthropic Claude.

    Parameters
    ----------
    api_key : str
        Anthropic Claude API key.
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
        If the Claude API call fails.

    """
    if not api_key:
        msg = "Claude API key is not configured"
        raise ValueError(msg)

    # Truncate content if too large
    if len(content) > MAX_CONTENT_CHARS:
        content = content[:MAX_CONTENT_CHARS] + "\n\n... (content truncated for context limit)"
        logger.info("Truncated content from %d to %d chars", len(content), MAX_CONTENT_CHARS)

    # Build the system prompt (Claude supports a dedicated system parameter)
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

    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        response = await client.messages.create(
            model=DEFAULT_MODEL,
            max_tokens=8192,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
        )
        result = response.content[0].text
    except Exception as exc:
        logger.exception("Claude API call failed for summary_type=%s", summary_type.value)
        msg = f"AI summary generation failed: {exc}"
        raise RuntimeError(msg) from exc

    logger.info("Generated %s summary (%d chars)", summary_type.value, len(result))
    return result


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
        Anthropic Claude API key.
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
        If the Claude API call fails.

    """
    if not api_key:
        msg = "Claude API key is not configured"
        raise ValueError(msg)

    # Truncate content if too large (smaller limit for chat to leave room for history)
    if len(content) > MAX_CHAT_CONTEXT_CHARS:
        content = content[:MAX_CHAT_CONTEXT_CHARS] + "\n\n... (content truncated for context limit)"
        logger.info("Truncated chat context to %d chars", MAX_CHAT_CONTEXT_CHARS)

    # Build the system prompt with repository context
    # Claude's system parameter keeps this separate from the conversation
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

    # Build messages array — Claude uses standard user/assistant roles
    messages: list[dict[str, str]] = []
    if history:
        for msg_item in history:
            messages.append({"role": msg_item["role"], "content": msg_item["content"]})
    messages.append({"role": "user", "content": message})

    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        response = await client.messages.create(
            model=DEFAULT_MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
        )
        result = response.content[0].text
    except Exception as exc:
        logger.exception("Claude chat API call failed")
        msg = f"AI chat failed: {exc}"
        raise RuntimeError(msg) from exc

    logger.info("Generated chat response (%d chars)", len(result))
    return result
