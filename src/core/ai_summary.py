"""AI-powered repository summary generation using Google Gemini."""

from __future__ import annotations

import logging
from enum import StrEnum

import google.generativeai as genai

logger = logging.getLogger(__name__)

# Maximum characters to send to Gemini (leave room for prompt within 2M context)
MAX_CONTENT_CHARS = 1_500_000


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
        Google Gemini API key.
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
        msg = "Gemini API key is not configured"
        raise ValueError(msg)

    # Truncate content if too large
    if len(content) > MAX_CONTENT_CHARS:
        content = content[:MAX_CONTENT_CHARS] + "\n\n... (content truncated for context limit)"
        logger.info("Truncated content from %d to %d chars", len(content), MAX_CONTENT_CHARS)

    # Configure the API
    genai.configure(api_key=api_key)

    # Build the prompt
    type_label = SUMMARY_TYPE_LABELS.get(summary_type, summary_type.value)
    prompt = (
        f"You are an expert software engineer analyzing a code repository.\n"
        f"Generate a {type_label} for this repository.\n\n"
        f"{SUMMARY_PROMPTS[summary_type]}\n\n"
        f"## Directory Structure\n```\n{tree}\n```\n\n"
        f"## File Contents\n{content}"
    )

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = await model.generate_content_async(prompt)
        result = response.text
    except Exception as exc:
        logger.exception("Gemini API call failed for summary_type=%s", summary_type.value)
        msg = f"AI summary generation failed: {exc}"
        raise RuntimeError(msg) from exc

    logger.info("Generated %s summary (%d chars)", summary_type.value, len(result))
    return result
