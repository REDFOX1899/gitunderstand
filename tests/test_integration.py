"""Integration tests for the full ingest → format → output pipeline."""

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


class TestFullPipeline:
    """End-to-end tests for ingest → format → output."""

    def test_python_project_structure(self, tmp_path: Path) -> None:
        """Simulate a small Python project and verify the full output."""
        proj = tmp_path / "myproject"
        proj.mkdir()

        # Create a realistic Python project structure
        (proj / "README.md").write_text("# My Project\nA sample project.")
        (proj / "setup.py").write_text("from setuptools import setup\nsetup(name='myproject')")
        (proj / "requirements.txt").write_text("fastapi==0.100.0\nuvicorn==0.23.0")

        src = proj / "src"
        src.mkdir()
        (src / "__init__.py").write_text("")
        (src / "main.py").write_text(
            "from fastapi import FastAPI\n\napp = FastAPI()\n\n"
            "@app.get('/')\ndef root():\n    return {'hello': 'world'}\n"
        )
        (src / "utils.py").write_text("def add(a: int, b: int) -> int:\n    return a + b\n")

        tests_dir = proj / "tests"
        tests_dir.mkdir()
        (tests_dir / "__init__.py").write_text("")
        (tests_dir / "test_main.py").write_text("def test_root():\n    assert True\n")

        query = _make_query(proj)
        summary, tree, content, token_counts, tree_json = ingest_query(query)

        # Verify tree contains all directories and files
        assert "src" in tree
        assert "tests" in tree
        assert "main.py" in tree
        assert "utils.py" in tree
        assert "README.md" in tree
        assert "requirements.txt" in tree
        assert "setup.py" in tree

        # Verify content includes file contents
        assert "FastAPI" in content
        assert "def add" in content
        assert "def test_root" in content

        # Verify token counts are computed
        assert len(token_counts) > 0
        for model, count in token_counts.items():
            assert count > 0, f"Token count for {model} should be positive"

        # Verify tree_json is a valid dict with expected structure
        assert isinstance(tree_json, dict)
        assert "name" in tree_json
        assert "children" in tree_json

    def test_nested_directory_depth(self, tmp_path: Path) -> None:
        """Test that deeply nested directories are processed correctly."""
        proj = tmp_path / "deep"
        proj.mkdir()

        # Create 5-level deep nesting
        current = proj
        for i in range(5):
            current = current / f"level{i}"
            current.mkdir()
            (current / f"file{i}.txt").write_text(f"Content at level {i}")

        query = _make_query(proj)
        summary, tree, content, token_counts, tree_json = ingest_query(query)

        # All levels should be in the tree
        for i in range(5):
            assert f"level{i}" in tree
            assert f"file{i}.txt" in tree
            assert f"Content at level {i}" in content

    def test_mixed_file_types(self, tmp_path: Path) -> None:
        """Test ingestion of various file types."""
        proj = tmp_path / "mixed"
        proj.mkdir()

        (proj / "app.py").write_text("print('python')")
        (proj / "index.js").write_text("console.log('javascript')")
        (proj / "style.css").write_text("body { color: red; }")
        (proj / "config.json").write_text('{"key": "value"}')
        (proj / "notes.md").write_text("# Notes\nSome notes here.")

        query = _make_query(proj)
        summary, tree, content, token_counts, tree_json = ingest_query(query)

        assert "app.py" in tree
        assert "index.js" in tree
        assert "style.css" in tree
        assert "config.json" in tree
        assert "notes.md" in tree

    def test_ignore_and_include_combined(self, tmp_path: Path) -> None:
        """Test that ignore patterns take precedence over include patterns."""
        proj = tmp_path / "filters"
        proj.mkdir()

        (proj / "keep.py").write_text("keep this")
        (proj / "skip.pyc").write_text("compiled")
        (proj / "data.txt").write_text("data")
        (proj / "temp.log").write_text("log entry")

        query = _make_query(proj, ignore_patterns={"*.pyc", "*.log"})
        summary, tree, content, token_counts, tree_json = ingest_query(query)

        assert "keep.py" in tree
        assert "data.txt" in tree
        assert "skip.pyc" not in tree
        assert "temp.log" not in tree

    def test_binary_files_skipped(self, tmp_path: Path) -> None:
        """Test that binary files don't crash the ingestion."""
        proj = tmp_path / "withbinary"
        proj.mkdir()

        (proj / "code.py").write_text("x = 1")
        # Write some binary content
        (proj / "image.bin").write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)

        query = _make_query(proj)
        # Should not raise
        summary, tree, content, token_counts, tree_json = ingest_query(query)
        assert "code.py" in tree

    def test_tree_json_structure(self, tmp_path: Path) -> None:
        """Verify the JSON tree structure returned by ingest_query."""
        proj = tmp_path / "treejson"
        proj.mkdir()

        src = proj / "src"
        src.mkdir()
        (src / "app.py").write_text("app = True")
        (proj / "README.md").write_text("# Readme")

        query = _make_query(proj)
        summary, tree, content, token_counts, tree_json = ingest_query(query)

        # Root node
        assert tree_json["name"] == "treejson"
        assert tree_json["type"] == "directory"
        assert isinstance(tree_json["children"], list)
        assert len(tree_json["children"]) > 0

        # Find the src directory in children
        src_node = next((c for c in tree_json["children"] if c["name"] == "src"), None)
        assert src_node is not None
        assert src_node["type"] == "directory"

    def test_empty_files_handled(self, tmp_path: Path) -> None:
        """Test that empty files are handled without errors."""
        proj = tmp_path / "empties"
        proj.mkdir()

        (proj / "empty.py").write_text("")
        (proj / "notempty.py").write_text("x = 1")

        query = _make_query(proj)
        summary, tree, content, token_counts, tree_json = ingest_query(query)

        assert "notempty.py" in tree
