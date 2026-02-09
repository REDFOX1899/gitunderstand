"""Tests for the smart chunking module."""

from __future__ import annotations

import pytest

from core.chunking import (
    FileBlock,
    _bin_pack_files,
    _build_manifest,
    _count_tokens_for_model,
    _extract_path_from_block,
    _parse_file_blocks,
    chunk_content,
)
from core.schemas.filesystem import SEPARATOR

# ---------------------------------------------------------------------------
# Helpers for building test fixtures
# ---------------------------------------------------------------------------

def _make_file_block(path: str, content_lines: int = 10, token_count: int | None = None) -> str:
    """Build a fake file block string with the standard separator format."""
    body = "\n".join(f"line {i}" for i in range(content_lines))
    block = f"{SEPARATOR}\nFILE: {path}\n{SEPARATOR}\n{body}"
    return block


def _make_content(*paths: str, content_lines: int = 10) -> str:
    """Build concatenated content for multiple files."""
    return "\n".join(_make_file_block(p, content_lines) for p in paths)


# ---------------------------------------------------------------------------
# TestExtractPathFromBlock
# ---------------------------------------------------------------------------


class TestExtractPathFromBlock:
    """Tests for _extract_path_from_block helper."""

    def test_extracts_file_path(self) -> None:
        block = f"{SEPARATOR}\nFILE: src/main.py\n{SEPARATOR}\nprint('hello')"
        assert _extract_path_from_block(block) == "src/main.py"

    def test_extracts_directory_path(self) -> None:
        block = f"{SEPARATOR}\nDIRECTORY: src/utils\n{SEPARATOR}\n"
        assert _extract_path_from_block(block) == "src/utils"

    def test_extracts_symlink_path(self) -> None:
        block = f"{SEPARATOR}\nSYMLINK: link.txt\n{SEPARATOR}\ntarget"
        assert _extract_path_from_block(block) == "link.txt"

    def test_returns_unknown_for_no_header(self) -> None:
        block = f"{SEPARATOR}\nsome random text\n{SEPARATOR}\ncontent"
        assert _extract_path_from_block(block) == "unknown"

    def test_returns_unknown_for_empty_block(self) -> None:
        assert _extract_path_from_block("") == "unknown"


# ---------------------------------------------------------------------------
# TestParseFileBlocks
# ---------------------------------------------------------------------------


class TestParseFileBlocks:
    """Tests for _parse_file_blocks."""

    def test_single_file(self) -> None:
        content = _make_file_block("src/app.py", content_lines=5)
        blocks = _parse_file_blocks(content, "GPT-4o")

        assert len(blocks) == 1
        assert blocks[0].path == "src/app.py"
        assert blocks[0].token_count > 0

    def test_multiple_files(self) -> None:
        content = _make_content("a.py", "b.py", "c.py")
        blocks = _parse_file_blocks(content, "Claude")

        assert len(blocks) == 3
        assert [b.path for b in blocks] == ["a.py", "b.py", "c.py"]

    def test_empty_content(self) -> None:
        assert _parse_file_blocks("", "GPT-4o") == []

    def test_whitespace_only_content(self) -> None:
        assert _parse_file_blocks("   \n\n  ", "Gemini") == []

    def test_preserves_file_content(self) -> None:
        """The block content should contain the full separator + file content."""
        content = _make_file_block("test.py", content_lines=3)
        blocks = _parse_file_blocks(content, "GPT-4o")

        assert len(blocks) == 1
        assert "FILE: test.py" in blocks[0].content
        assert "line 0" in blocks[0].content
        assert "line 2" in blocks[0].content


# ---------------------------------------------------------------------------
# TestBinPacking
# ---------------------------------------------------------------------------


class TestBinPacking:
    """Tests for _bin_pack_files."""

    def test_single_bin_when_all_fit(self) -> None:
        """All files should fit in one bin when total < budget."""
        blocks = [
            FileBlock("a.py", "content_a", 100),
            FileBlock("b.py", "content_b", 200),
            FileBlock("c.py", "content_c", 150),
        ]
        bins = _bin_pack_files(blocks, token_budget=500)

        assert len(bins) == 1
        assert len(bins[0]) == 3

    def test_multiple_bins_when_exceeds_budget(self) -> None:
        """Files should be split into multiple bins if total > budget."""
        blocks = [
            FileBlock("a.py", "content_a", 300),
            FileBlock("b.py", "content_b", 300),
            FileBlock("c.py", "content_c", 300),
        ]
        bins = _bin_pack_files(blocks, token_budget=500)

        # 300 + 300 > 500, so at least 2 bins
        assert len(bins) >= 2

    def test_large_file_gets_own_bin(self) -> None:
        """A file exceeding the budget gets its own bin."""
        blocks = [
            FileBlock("small.py", "content_s", 100),
            FileBlock("huge.py", "content_h", 1000),
        ]
        bins = _bin_pack_files(blocks, token_budget=500)

        # huge.py must be in its own bin
        huge_bins = [b for b in bins if any(fb.path == "huge.py" for fb in b)]
        assert len(huge_bins) == 1
        assert len(huge_bins[0]) == 1

    def test_respects_budget(self) -> None:
        """No bin should exceed the budget (except for oversized files)."""
        blocks = [
            FileBlock(f"file{i}.py", f"content_{i}", 100)
            for i in range(10)
        ]
        bins = _bin_pack_files(blocks, token_budget=350)

        for b in bins:
            total = sum(fb.token_count for fb in b)
            assert total <= 350

    def test_preserves_original_order_within_bins(self) -> None:
        """Files within each bin should maintain their original relative order."""
        blocks = [
            FileBlock("a.py", "a", 100),
            FileBlock("b.py", "b", 50),
            FileBlock("c.py", "c", 80),
            FileBlock("d.py", "d", 200),
        ]
        bins = _bin_pack_files(blocks, token_budget=300)

        for b in bins:
            paths = [fb.path for fb in b]
            original_indices = [
                next(i for i, fb in enumerate(blocks) if fb.path == p)
                for p in paths
            ]
            assert original_indices == sorted(original_indices)

    def test_empty_input(self) -> None:
        assert _bin_pack_files([], token_budget=1000) == []


# ---------------------------------------------------------------------------
# TestBuildManifest
# ---------------------------------------------------------------------------


class TestBuildManifest:
    """Tests for _build_manifest."""

    def test_manifest_format(self) -> None:
        manifest = _build_manifest(
            chunk_index=0,
            total_chunks=3,
            chunk_files=["a.py", "b.py"],
            all_files=["a.py", "b.py", "c.py", "d.py", "e.py"],
        )

        assert "CHUNK 1/3" in manifest
        assert "Files in this chunk (2 of 5):" in manifest
        assert "Total files in repository: 5" in manifest

    def test_manifest_file_listing(self) -> None:
        manifest = _build_manifest(
            chunk_index=1,
            total_chunks=2,
            chunk_files=["src/main.py", "src/utils.py"],
            all_files=["src/main.py", "src/utils.py", "README.md"],
        )

        assert "  - src/main.py" in manifest
        assert "  - src/utils.py" in manifest

    def test_manifest_chunk_numbering_is_one_based(self) -> None:
        """Chunk index is 0-based internally but manifest should show 1-based."""
        manifest = _build_manifest(0, 5, ["a.py"], ["a.py", "b.py"])
        assert "CHUNK 1/5" in manifest

        manifest2 = _build_manifest(4, 5, ["b.py"], ["a.py", "b.py"])
        assert "CHUNK 5/5" in manifest2

    def test_manifest_has_dividers(self) -> None:
        manifest = _build_manifest(0, 1, ["a.py"], ["a.py"])
        assert "═" in manifest


# ---------------------------------------------------------------------------
# TestCountTokensForModel
# ---------------------------------------------------------------------------


class TestCountTokensForModel:
    """Tests for _count_tokens_for_model."""

    def test_gpt4o_uses_tiktoken(self) -> None:
        """GPT-4o should return a positive integer from tiktoken."""
        count = _count_tokens_for_model("Hello world", "GPT-4o")
        assert isinstance(count, int)
        assert count > 0

    def test_claude_uses_tiktoken(self) -> None:
        count = _count_tokens_for_model("Hello world", "Claude")
        assert isinstance(count, int)
        assert count > 0

    def test_gemini_uses_char_based(self) -> None:
        """Gemini should use chars/4 estimation."""
        text = "a" * 400
        count = _count_tokens_for_model(text, "Gemini")
        assert count == 100  # 400 / 4

    def test_gemini_returns_at_least_one(self) -> None:
        """Gemini estimate should return at least 1 even for short text."""
        count = _count_tokens_for_model("ab", "Gemini")
        assert count >= 1

    def test_llama_uses_tiktoken(self) -> None:
        count = _count_tokens_for_model("Hello world", "Llama 3")
        assert isinstance(count, int)
        assert count > 0

    def test_longer_text_more_tokens(self) -> None:
        short_count = _count_tokens_for_model("Hi", "GPT-4o")
        long_count = _count_tokens_for_model("Hello world " * 100, "GPT-4o")
        assert long_count > short_count


# ---------------------------------------------------------------------------
# TestChunkContent — integration-style tests
# ---------------------------------------------------------------------------


class TestChunkContent:
    """Tests for chunk_content (the main entry point)."""

    def test_no_chunking_when_fits(self) -> None:
        """Small content should return a single chunk."""
        content = _make_content("a.py", "b.py", content_lines=5)
        tree = "└── a.py\n└── b.py"
        summary = "2 files, 10 lines"

        chunks = chunk_content(content, tree, summary, "Claude")

        assert len(chunks) == 1
        assert chunks[0].index == 0
        assert chunks[0].total_chunks == 1

    def test_all_files_covered(self) -> None:
        """Union of chunk files should equal the full file list."""
        content = _make_content("a.py", "b.py", "c.py", content_lines=5)
        tree = "└── a.py\n└── b.py\n└── c.py"
        summary = "3 files"

        chunks = chunk_content(content, tree, summary, "Gemini")

        all_chunk_files: set[str] = set()
        for c in chunks:
            all_chunk_files.update(c.files)

        expected = {"a.py", "b.py", "c.py"}
        assert all_chunk_files == expected

    def test_chunks_have_correct_metadata(self) -> None:
        """Each chunk should have correct index and total_chunks."""
        # Create a large content that will need chunking with a small budget
        content = _make_content(
            *[f"file{i}.py" for i in range(20)],
            content_lines=50,
        )
        tree = "└── ..."
        summary = "20 files"

        # Use a very small max_tokens to force multiple chunks
        chunks = chunk_content(content, tree, summary, "GPT-4o", max_tokens=2000)

        assert len(chunks) > 1
        for i, chunk in enumerate(chunks):
            assert chunk.index == i
            assert chunk.total_chunks == len(chunks)

    def test_tree_in_every_chunk(self) -> None:
        """Each chunk should contain the tree structure."""
        content = _make_content(
            *[f"file{i}.py" for i in range(10)],
            content_lines=50,
        )
        tree = "└── UNIQUE_TREE_MARKER"
        summary = "10 files"

        chunks = chunk_content(content, tree, summary, "GPT-4o", max_tokens=2000)

        for chunk in chunks:
            assert "UNIQUE_TREE_MARKER" in chunk.content

    def test_manifest_in_multichunk(self) -> None:
        """Multi-chunk results should have manifest headers."""
        content = _make_content(
            *[f"file{i}.py" for i in range(10)],
            content_lines=50,
        )
        tree = "└── ..."
        summary = "10 files"

        chunks = chunk_content(content, tree, summary, "GPT-4o", max_tokens=2000)

        if len(chunks) > 1:
            for chunk in chunks:
                assert "CHUNK" in chunk.content

    def test_chunks_for_claude_fewer_than_gpt4o(self) -> None:
        """Claude (200k) should produce fewer or equal chunks than GPT-4o (128k)."""
        content = _make_content(
            *[f"file{i}.py" for i in range(30)],
            content_lines=100,
        )
        tree = "└── ..."
        summary = "30 files"

        gpt_chunks = chunk_content(content, tree, summary, "GPT-4o")
        claude_chunks = chunk_content(content, tree, summary, "Claude")

        assert len(claude_chunks) <= len(gpt_chunks)

    def test_gemini_likely_single_chunk(self) -> None:
        """Gemini with 2M context should keep most repos in a single chunk."""
        content = _make_content(
            *[f"file{i}.py" for i in range(20)],
            content_lines=50,
        )
        tree = "└── ..."
        summary = "20 files"

        chunks = chunk_content(content, tree, summary, "Gemini")

        assert len(chunks) == 1

    def test_custom_max_tokens(self) -> None:
        """Custom max_tokens should override model default."""
        content = _make_content(
            *[f"file{i}.py" for i in range(10)],
            content_lines=50,
        )
        tree = "└── ..."
        summary = "10 files"

        # Very small budget → many chunks
        small_chunks = chunk_content(content, tree, summary, "Gemini", max_tokens=1500)
        # Large budget → fewer chunks
        large_chunks = chunk_content(content, tree, summary, "Gemini", max_tokens=500_000)

        assert len(small_chunks) >= len(large_chunks)

    def test_invalid_model_raises(self) -> None:
        """Unknown model should raise ValueError."""
        with pytest.raises(ValueError, match="Unknown target model"):
            chunk_content("content", "tree", "summary", "NotAModel")

    def test_empty_content(self) -> None:
        """Empty content should return a single chunk with just the tree."""
        chunks = chunk_content("", "└── (empty)", "0 files", "GPT-4o")

        assert len(chunks) == 1
        assert chunks[0].files == []
        assert chunks[0].total_chunks == 1

    def test_single_chunk_has_all_files_field(self) -> None:
        """Single chunk result should have all_files populated."""
        content = _make_content("a.py", "b.py", content_lines=5)
        tree = "└── ..."
        summary = "2 files"

        chunks = chunk_content(content, tree, summary, "Gemini")

        assert len(chunks) == 1
        assert set(chunks[0].all_files) == {"a.py", "b.py"}
        assert chunks[0].all_files == chunks[0].files

    def test_chunk_token_counts_are_positive(self) -> None:
        """Each chunk should have a positive token count."""
        content = _make_content("a.py", "b.py", content_lines=5)
        tree = "└── ..."
        summary = "2 files"

        chunks = chunk_content(content, tree, summary, "GPT-4o")

        for chunk in chunks:
            assert chunk.token_count > 0
