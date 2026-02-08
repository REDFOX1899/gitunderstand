"""Multi-format output renderers for repository digests.

Supports text (default), JSON, Markdown, and XML output formats.
Each formatter takes a FileSystemNode tree and IngestionQuery and produces
structured output appropriate for its format.
"""

from __future__ import annotations

import json
import os
import xml.etree.ElementTree as ET  # noqa: N817
from enum import StrEnum
from pathlib import Path
from typing import TYPE_CHECKING, Any

from core.schemas import FileSystemNode, FileSystemNodeType
from core.token_counting import format_token_count

if TYPE_CHECKING:
    from core.schemas import IngestionQuery

# File extension to language mapping for common languages
_EXT_TO_LANGUAGE: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".jsx": "jsx",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".less": "less",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".toml": "toml",
    ".ini": "ini",
    ".cfg": "ini",
    ".md": "markdown",
    ".rst": "rst",
    ".sql": "sql",
    ".r": "r",
    ".R": "r",
    ".lua": "lua",
    ".dart": "dart",
    ".ex": "elixir",
    ".exs": "elixir",
    ".erl": "erlang",
    ".hs": "haskell",
    ".pl": "perl",
    ".dockerfile": "dockerfile",
    ".tf": "hcl",
    ".vue": "vue",
    ".svelte": "svelte",
}


class OutputFormat(StrEnum):
    """Supported output formats for repository digests."""

    TEXT = "text"
    JSON = "json"
    MARKDOWN = "markdown"
    XML = "xml"


def detect_language(file_path: str) -> str:
    """Detect the programming language from a file path.

    Parameters
    ----------
    file_path : str
        Path to the file.

    Returns
    -------
    str
        The detected language name, or ``"text"`` if unknown.

    """
    name = Path(file_path).name.lower()

    # Special filenames
    if name == "dockerfile":
        return "dockerfile"
    if name == "makefile":
        return "makefile"
    if name in {"gemfile", "rakefile"}:
        return "ruby"

    ext = Path(file_path).suffix.lower()
    return _EXT_TO_LANGUAGE.get(ext, "text")


def _collect_files(node: FileSystemNode) -> list[FileSystemNode]:
    """Recursively collect all file nodes from the tree."""
    if node.type == FileSystemNodeType.FILE:
        return [node]
    if node.type == FileSystemNodeType.DIRECTORY:
        files: list[FileSystemNode] = []
        for child in node.children:
            files.extend(_collect_files(child))
        return files
    return []


def _file_to_dict(node: FileSystemNode) -> dict[str, Any]:
    """Convert a file node to a dictionary with metadata."""
    path_str = str(node.path_str).replace(os.sep, "/")
    content = node.content
    language = detect_language(path_str)

    return {
        "path": path_str,
        "language": language,
        "size": node.size,
        "content": content,
    }


# ---------------------------------------------------------------------------
# JSON formatter
# ---------------------------------------------------------------------------


def format_json(
    node: FileSystemNode,
    query: IngestionQuery,
    summary: str,
    tree: str,
    token_counts: dict[str, int],
) -> str:
    """Format the digest as a JSON document with per-file metadata.

    Parameters
    ----------
    node : FileSystemNode
        Root node of the file tree.
    query : IngestionQuery
        The ingestion query with repo metadata.
    summary : str
        The text summary.
    tree : str
        The directory tree string.
    token_counts : dict[str, int]
        Token counts per model.

    Returns
    -------
    str
        JSON string.

    """
    files = _collect_files(node)

    output: dict[str, Any] = {
        "repository": {
            "url": query.url,
            "user": query.user_name,
            "name": query.repo_name,
            "branch": query.branch,
            "commit": query.commit,
            "tag": query.tag,
            "subpath": query.subpath if query.subpath != "/" else None,
        },
        "summary": summary,
        "tree": tree,
        "token_counts": token_counts,
        "file_count": len(files),
        "files": [_file_to_dict(f) for f in files],
    }

    return json.dumps(output, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Markdown formatter
# ---------------------------------------------------------------------------


def format_markdown(
    node: FileSystemNode,
    query: IngestionQuery,
    summary: str,
    tree: str,
    token_counts: dict[str, int],
) -> str:
    """Format the digest as a Markdown document with fenced code blocks.

    Parameters
    ----------
    node : FileSystemNode
        Root node of the file tree.
    query : IngestionQuery
        The ingestion query with repo metadata.
    summary : str
        The text summary.
    tree : str
        The directory tree string.
    token_counts : dict[str, int]
        Token counts per model.

    Returns
    -------
    str
        Markdown string.

    """
    parts: list[str] = []

    # Header
    repo_name = f"{query.user_name}/{query.repo_name}" if query.user_name else query.slug
    parts.append(f"# {repo_name}\n")

    # Summary
    parts.append("## Summary\n")
    parts.append(f"```\n{summary}\n```\n")

    # Token counts
    if token_counts:
        parts.append("## Token Estimates\n")
        parts.append("| Model | Tokens |")
        parts.append("|-------|--------|")
        for model, count in token_counts.items():
            parts.append(f"| {model} | {format_token_count(count)} |")
        parts.append("")

    # Directory structure
    parts.append("## Directory Structure\n")
    parts.append(f"```\n{tree}\n```\n")

    # Files
    parts.append("## Files\n")
    files = _collect_files(node)
    for f in files:
        path_str = str(f.path_str).replace(os.sep, "/")
        language = detect_language(path_str)
        content = f.content
        parts.append(f"### `{path_str}`\n")
        parts.append(f"```{language}\n{content}\n```\n")

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# XML formatter
# ---------------------------------------------------------------------------


def format_xml(
    node: FileSystemNode,
    query: IngestionQuery,
    summary: str,
    tree: str,
    token_counts: dict[str, int],
) -> str:
    """Format the digest as an XML document.

    Parameters
    ----------
    node : FileSystemNode
        Root node of the file tree.
    query : IngestionQuery
        The ingestion query with repo metadata.
    summary : str
        The text summary.
    tree : str
        The directory tree string.
    token_counts : dict[str, int]
        Token counts per model.

    Returns
    -------
    str
        XML string.

    """
    root = ET.Element("repository")

    # Metadata
    meta = ET.SubElement(root, "metadata")
    if query.url:
        ET.SubElement(meta, "url").text = str(query.url)
    if query.user_name:
        ET.SubElement(meta, "user").text = query.user_name
    if query.repo_name:
        ET.SubElement(meta, "name").text = query.repo_name
    if query.branch:
        ET.SubElement(meta, "branch").text = query.branch
    if query.commit:
        ET.SubElement(meta, "commit").text = query.commit

    # Summary
    ET.SubElement(root, "summary").text = summary

    # Token counts
    tokens_el = ET.SubElement(root, "token_counts")
    for model, count in token_counts.items():
        el = ET.SubElement(tokens_el, "model", name=model)
        el.text = str(count)

    # Tree
    ET.SubElement(root, "tree").text = tree

    # Files
    files_el = ET.SubElement(root, "files")
    for f in _collect_files(node):
        path_str = str(f.path_str).replace(os.sep, "/")
        language = detect_language(path_str)
        file_el = ET.SubElement(
            files_el,
            "file",
            path=path_str,
            language=language,
            size=str(f.size),
        )
        file_el.text = f.content

    ET.indent(root, space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------


def format_output(
    output_format: OutputFormat,
    node: FileSystemNode,
    query: IngestionQuery,
    summary: str,
    tree: str,
    content: str,
    token_counts: dict[str, int],
) -> str:
    """Produce formatted output in the requested format.

    For ``TEXT``, returns the existing content string unchanged.
    For other formats, generates structured output from the node tree.

    Parameters
    ----------
    output_format : OutputFormat
        The desired output format.
    node : FileSystemNode
        Root node of the file tree.
    query : IngestionQuery
        The ingestion query.
    summary : str
        The text summary.
    tree : str
        The directory tree string.
    content : str
        The text content (used for TEXT format).
    token_counts : dict[str, int]
        Token counts per model.

    Returns
    -------
    str
        Formatted output string.

    """
    if output_format == OutputFormat.TEXT:
        return content
    if output_format == OutputFormat.JSON:
        return format_json(node, query, summary, tree, token_counts)
    if output_format == OutputFormat.MARKDOWN:
        return format_markdown(node, query, summary, tree, token_counts)
    if output_format == OutputFormat.XML:
        return format_xml(node, query, summary, tree, token_counts)

    return content
