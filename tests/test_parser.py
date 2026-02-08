"""Tests for the URL/path parser module."""

from __future__ import annotations

import uuid
from pathlib import Path

from core.schemas.ingestion import IngestionQuery


class TestIngestionQueryModel:
    """Tests for the IngestionQuery Pydantic model."""

    def test_default_ignore_patterns(self) -> None:
        """Test that ignore_patterns defaults to empty set."""
        query = IngestionQuery(
            user_name="test",
            repo_name="repo",
            local_path=Path("/tmp/test"),
            slug="test/repo",
            id=uuid.uuid4(),
        )
        assert isinstance(query.ignore_patterns, set)

    def test_default_include_patterns(self) -> None:
        """Test that include_patterns defaults to empty set."""
        query = IngestionQuery(
            user_name="test",
            repo_name="repo",
            local_path=Path("/tmp/test"),
            slug="test/repo",
            id=uuid.uuid4(),
        )
        assert isinstance(query.include_patterns, set)

    def test_extract_clone_config(self) -> None:
        """Test extracting CloneConfig from IngestionQuery."""
        query = IngestionQuery(
            user_name="test",
            repo_name="repo",
            url="https://github.com/test/repo",
            local_path=Path("/tmp/test"),
            slug="test/repo",
            id=uuid.uuid4(),
            branch="main",
            commit="abc123",
        )
        config = query.extract_clone_config()
        assert config.url == "https://github.com/test/repo"
        assert config.branch == "main"
        assert config.commit == "abc123"

    def test_extract_clone_config_requires_url(self) -> None:
        """Test that extract_clone_config raises without URL."""
        query = IngestionQuery(
            user_name="test",
            repo_name="repo",
            local_path=Path("/tmp/test"),
            slug="test/repo",
            id=uuid.uuid4(),
        )
        try:
            query.extract_clone_config()
            raise AssertionError("Should have raised ValueError")
        except ValueError:
            pass
