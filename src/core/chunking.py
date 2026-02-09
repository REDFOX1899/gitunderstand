"""Smart chunking for repository digests.

Splits large digests into model-optimized chunks that respect file
boundaries and include navigation manifests. Each chunk is sized to
fit within a target LLM's context window.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from core.schemas.filesystem import SEPARATOR
from core.token_counting import MODEL_CONTEXT_WINDOWS, _count_tiktoken

logger = logging.getLogger(__name__)

# Use 90% of context window to leave room for the user's prompt
_CONTEXT_WINDOW_RATIO = 0.9

# Estimated token overhead for the manifest header per chunk
_MANIFEST_OVERHEAD_TOKENS = 500

# Model name → tiktoken encoding mapping
_MODEL_ENCODINGS: dict[str, str | None] = {
    "GPT-4o": "o200k_base",
    "Claude": "cl100k_base",
    "Gemini": None,  # character-based
    "Llama 3": "o200k_base",
}

# Separator pattern used to split content into file blocks.
# Each file block starts with a separator line followed by FILE:/DIRECTORY:/SYMLINK:
# The format is:
#   ================================================
#   FILE: path/to/file.py
#   ================================================
#   <file content>
# We split on the separator line that precedes a FILE/DIRECTORY/SYMLINK line,
# keeping it as part of the next block.
_FILE_BLOCK_PATTERN = re.compile(
    rf"(?=^{re.escape(SEPARATOR)}\n(?:FILE|DIRECTORY|SYMLINK):)",
    re.MULTILINE,
)


@dataclass(frozen=True)
class FileBlock:
    """A single file extracted from the digest content.

    Attributes
    ----------
    path : str
        Relative file path extracted from the separator header.
    content : str
        Full content block including separator, header, and file content.
    token_count : int
        Token count for this block using the target model's encoding.

    """

    path: str
    content: str
    token_count: int


@dataclass(frozen=True)
class Chunk:
    """A single chunk of the digest, sized for a target model.

    Attributes
    ----------
    index : int
        Zero-based chunk index.
    total_chunks : int
        Total number of chunks.
    files : list[str]
        File paths included in this chunk.
    token_count : int
        Total token count for this chunk.
    content : str
        Full content string (manifest + tree + file contents).
    all_files : list[str]
        Complete file list across all chunks.

    """

    index: int
    total_chunks: int
    files: list[str] = field(default_factory=list)
    token_count: int = 0
    content: str = ""
    all_files: list[str] = field(default_factory=list)


def chunk_content(
    content: str,
    tree: str,
    summary: str,
    target_model: str,
    max_tokens: int | None = None,
) -> list[Chunk]:
    """Split digest content into model-optimised chunks.

    Algorithm
    ---------
    1. Parse *content* into :class:`FileBlock` objects by splitting on ``SEPARATOR``.
    2. Count tokens for each block using the target model's encoding.
    3. Calculate token budget = effective_window − tree_tokens − manifest_overhead.
    4. Bin-pack file blocks into groups that fit within the budget.
    5. Prepend a manifest header and tree to each chunk.
    6. Return a list of :class:`Chunk` objects.

    If the entire content fits in a single chunk the function returns a
    one-element list with ``index=0`` and ``total_chunks=1``.

    Parameters
    ----------
    content : str
        Concatenated file contents (output of ``_gather_file_contents``).
    tree : str
        Directory tree string.
    summary : str
        Digest summary (used in the manifest).
    target_model : str
        One of the keys in :data:`MODEL_CONTEXT_WINDOWS`.
    max_tokens : int | None
        Optional custom token budget that overrides the model default.

    Returns
    -------
    list[Chunk]
        Ordered list of chunks.

    Raises
    ------
    ValueError
        If *target_model* is not a recognised model name.

    """
    if target_model not in MODEL_CONTEXT_WINDOWS:
        msg = (
            f"Unknown target model {target_model!r}. "
            f"Supported models: {', '.join(MODEL_CONTEXT_WINDOWS)}"
        )
        raise ValueError(msg)

    # Determine the effective token budget
    model_window = MODEL_CONTEXT_WINDOWS[target_model]
    effective_window = max_tokens if max_tokens else int(model_window * _CONTEXT_WINDOW_RATIO)

    # Parse content into file blocks
    file_blocks = _parse_file_blocks(content, target_model)

    if not file_blocks:
        # No files — return a single empty chunk
        return [
            Chunk(
                index=0,
                total_chunks=1,
                files=[],
                token_count=_count_tokens_for_model(tree, target_model),
                content=tree,
                all_files=[],
            ),
        ]

    all_files = [fb.path for fb in file_blocks]

    # Check if everything fits in a single chunk
    total_content_tokens = sum(fb.token_count for fb in file_blocks)
    tree_tokens = _count_tokens_for_model(tree, target_model)
    total_tokens = total_content_tokens + tree_tokens + _MANIFEST_OVERHEAD_TOKENS

    if total_tokens <= effective_window:
        # Everything fits — return one chunk with original content
        single_content = tree + "\n" + content
        return [
            Chunk(
                index=0,
                total_chunks=1,
                files=all_files,
                token_count=_count_tokens_for_model(single_content, target_model),
                content=single_content,
                all_files=all_files,
            ),
        ]

    # Need to split: calculate per-chunk budget (excluding tree + manifest)
    file_budget = effective_window - tree_tokens - _MANIFEST_OVERHEAD_TOKENS

    if file_budget <= 0:
        # Tree alone exceeds budget — put each file in its own chunk
        logger.warning(
            "Tree structure alone approaches token limit; chunking aggressively",
        )
        file_budget = effective_window // 2

    # Bin-pack files into groups
    bins = _bin_pack_files(file_blocks, file_budget)

    # Build final chunks with manifests
    total_chunks = len(bins)
    chunks: list[Chunk] = []

    for i, bin_blocks in enumerate(bins):
        chunk_files = [fb.path for fb in bin_blocks]
        manifest = _build_manifest(i, total_chunks, chunk_files, all_files)
        file_content = "\n".join(fb.content for fb in bin_blocks)
        full_content = manifest + "\n" + tree + "\n" + file_content

        chunks.append(
            Chunk(
                index=i,
                total_chunks=total_chunks,
                files=chunk_files,
                token_count=_count_tokens_for_model(full_content, target_model),
                content=full_content,
                all_files=all_files,
            ),
        )

    logger.info(
        "Chunked digest into %d chunks for %s (budget: %d tokens)",
        total_chunks,
        target_model,
        effective_window,
    )

    return chunks


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _count_tokens_for_model(text: str, model: str) -> int:
    """Count tokens using the model-specific encoding.

    Parameters
    ----------
    text : str
        The text to count tokens for.
    model : str
        Model name (must be a key in :data:`_MODEL_ENCODINGS`).

    Returns
    -------
    int
        Token count.

    """
    encoding = _MODEL_ENCODINGS.get(model)
    if encoding is None:
        # Gemini: character-based estimation
        return max(1, len(text) // 4)
    return _count_tiktoken(text, encoding)


def _parse_file_blocks(content: str, target_model: str) -> list[FileBlock]:
    """Split raw content into individual :class:`FileBlock` objects.

    Uses the ``SEPARATOR`` (``"=" * 48``) as the delimiter. Each block
    is expected to have the format::

        ================================================
        FILE: path/to/file.py
        ================================================
        <actual file content>

    Parameters
    ----------
    content : str
        The concatenated file contents.
    target_model : str
        Model name for token counting.

    Returns
    -------
    list[FileBlock]
        Ordered list of file blocks.

    """
    if not content or not content.strip():
        return []

    # Split on the file block pattern
    parts = _FILE_BLOCK_PATTERN.split(content)

    blocks: list[FileBlock] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue

        # Extract file path from the header
        path = _extract_path_from_block(part)
        token_count = _count_tokens_for_model(part, target_model)

        blocks.append(
            FileBlock(
                path=path,
                content=part,
                token_count=token_count,
            ),
        )

    return blocks


def _extract_path_from_block(block: str) -> str:
    """Extract the file path from a content block header.

    Looks for a line like ``FILE: path/to/file.py`` or
    ``DIRECTORY: path/to/dir`` between the separator lines.

    Parameters
    ----------
    block : str
        A single file content block.

    Returns
    -------
    str
        The extracted file path, or ``"unknown"`` if not found.

    """
    lines = block.split("\n")
    for line in lines[:5]:  # Path is always in the first few lines
        stripped = line.strip()
        if stripped.startswith(("FILE:", "DIRECTORY:", "SYMLINK:")):
            # Extract path after the colon
            return stripped.split(":", 1)[1].strip()
    return "unknown"


def _bin_pack_files(
    file_blocks: list[FileBlock],
    token_budget: int,
) -> list[list[FileBlock]]:
    """Bin-pack file blocks into groups within the token budget.

    Uses a first-fit-decreasing (FFD) strategy:

    1. Create indexed pairs to track original order.
    2. Sort by token count descending.
    3. For each file, place in the first bin that has room.
    4. If no bin has room, create a new one.
    5. Re-sort files within each bin back to their original order.

    Parameters
    ----------
    file_blocks : list[FileBlock]
        Ordered list of file blocks.
    token_budget : int
        Maximum tokens per bin.

    Returns
    -------
    list[list[FileBlock]]
        List of bins, each containing file blocks.

    """
    if not file_blocks:
        return []

    # Track original indices for re-ordering
    indexed = list(enumerate(file_blocks))

    # Sort by token count descending for FFD
    indexed.sort(key=lambda pair: pair[1].token_count, reverse=True)

    bins: list[list[tuple[int, FileBlock]]] = []
    bin_tokens: list[int] = []

    for orig_idx, fb in indexed:
        placed = False
        for bin_idx, current_tokens in enumerate(bin_tokens):
            if current_tokens + fb.token_count <= token_budget:
                bins[bin_idx].append((orig_idx, fb))
                bin_tokens[bin_idx] += fb.token_count
                placed = True
                break

        if not placed:
            # Create a new bin (even if file exceeds budget — it must go somewhere)
            bins.append([(orig_idx, fb)])
            bin_tokens.append(fb.token_count)

    # Re-sort each bin by original order
    result: list[list[FileBlock]] = []
    for bin_items in bins:
        bin_items.sort(key=lambda pair: pair[0])
        result.append([fb for _, fb in bin_items])

    return result


def _build_manifest(
    chunk_index: int,
    total_chunks: int,
    chunk_files: list[str],
    all_files: list[str],
) -> str:
    """Build a manifest header for a chunk.

    Parameters
    ----------
    chunk_index : int
        Zero-based index of this chunk.
    total_chunks : int
        Total number of chunks.
    chunk_files : list[str]
        File paths included in this chunk.
    all_files : list[str]
        Complete list of all file paths across all chunks.

    Returns
    -------
    str
        Formatted manifest header string.

    """
    divider = "═" * 40
    header = f"{divider}\n  CHUNK {chunk_index + 1}/{total_chunks}\n{divider}"

    file_list = "\n".join(f"  - {f}" for f in chunk_files)
    file_count_line = f"Files in this chunk ({len(chunk_files)} of {len(all_files)}):"

    return (
        f"{header}\n"
        f"{file_count_line}\n"
        f"{file_list}\n"
        f"Total files in repository: {len(all_files)}\n"
        f"{divider}\n"
    )
