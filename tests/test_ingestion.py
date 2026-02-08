"""Tests for the core ingestion module."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from core.ingestion import ingest_query
from core.schemas.ingestion import IngestionQuery

if TYPE_CHECKING:
    from pathlib import Path


def _make_query(path: Path, **overrides: object) -> IngestionQuery:
    """Create a minimal IngestionQuery for testing."""
    defaults = {
        "user_name": "test",
        "repo_name": "repo",
        "local_path": path,
        "slug": "test/repo",
        "id": uuid.uuid4(),
        "branch": "main",
        "max_file_size": 1_000_000,
        "ignore_patterns": set(),
    }
    defaults.update(overrides)
    return IngestionQuery(**defaults)


class TestIngestQuery:
    """Tests for the ingest_query function."""

    def test_ingest_basic_directory(self, temp_directory: Path) -> None:
        """Test ingesting a basic directory structure."""
        query = _make_query(temp_directory)
        summary, tree, content = ingest_query(query)

        assert summary is not None
        assert tree is not None
        assert content is not None
        assert "file1.txt" in tree
        assert "file2.py" in tree

    def test_ingest_counts_files(self, temp_directory: Path) -> None:
        """Test that ingestion counts files correctly."""
        query = _make_query(temp_directory)
        summary, tree, content = ingest_query(query)

        # Should find all 8 files in the temp_directory fixture
        assert "file1.txt" in content
        assert "file2.py" in content
        assert "subfile1.txt" in content

    def test_ingest_with_ignore_patterns(self, temp_directory: Path) -> None:
        """Test that ignore patterns filter out files."""
        query = _make_query(temp_directory, ignore_patterns={"*.py"})
        summary, tree, content = ingest_query(query)

        # .py files should be excluded
        assert "file2.py" not in tree
        assert "subfile2.py" not in tree
        # .txt files should still be there
        assert "file1.txt" in tree

    def test_ingest_with_include_patterns(self, temp_directory: Path) -> None:
        """Test that include patterns only include matching files."""
        query = _make_query(temp_directory, include_patterns={"*.txt"})
        summary, tree, content = ingest_query(query)

        # Only .txt files should be present
        assert "file1.txt" in tree
        assert "file2.py" not in tree

    def test_ingest_single_file(self, temp_directory: Path) -> None:
        """Test ingesting a single file."""
        file_path = temp_directory / "file1.txt"
        query = _make_query(file_path, type="blob")
        summary, tree, content = ingest_query(query)

        assert "Hello World" in content

    def test_ingest_respects_max_file_size(self, temp_directory: Path) -> None:
        """Test that files exceeding max_file_size are skipped."""
        # Create a large file
        large_file = temp_directory / "large.txt"
        large_file.write_text("x" * 10_000)

        query = _make_query(temp_directory, max_file_size=100)
        summary, tree, content = ingest_query(query)

        # Oversized files are completely skipped (not in tree or content)
        assert "large.txt" not in tree
        assert "x" * 10_000 not in content

    def test_ingest_empty_directory(self, tmp_path: Path) -> None:
        """Test ingesting an empty directory."""
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()
        query = _make_query(empty_dir)
        summary, tree, content = ingest_query(query)

        assert summary is not None
        assert tree is not None
