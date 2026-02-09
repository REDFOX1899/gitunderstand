"""Tests for the ``_create_tree_json`` helper in ``core.formatter``."""

from __future__ import annotations

from pathlib import Path

from core.formatter import _create_tree_json
from core.schemas import FileSystemNode, FileSystemNodeType


def _make_file(name: str, *, size: int = 100, path_str: str | None = None) -> FileSystemNode:
    """Create a minimal FILE node for testing."""
    return FileSystemNode(
        name=name,
        type=FileSystemNodeType.FILE,
        path_str=path_str or name,
        path=Path(f"/tmp/{name}"),
        size=size,
        file_count=1,
    )


def _make_dir(
    name: str,
    children: list[FileSystemNode] | None = None,
    *,
    path_str: str | None = None,
    size: int = 0,
) -> FileSystemNode:
    """Create a minimal DIRECTORY node for testing."""
    node = FileSystemNode(
        name=name,
        type=FileSystemNodeType.DIRECTORY,
        path_str=path_str or name,
        path=Path(f"/tmp/{name}"),
        size=size,
    )
    if children:
        node.children = children
    return node


def _make_symlink(name: str, *, path_str: str | None = None) -> FileSystemNode:
    """Create a minimal SYMLINK node for testing."""
    return FileSystemNode(
        name=name,
        type=FileSystemNodeType.SYMLINK,
        path_str=path_str or name,
        path=Path(f"/tmp/{name}"),
    )


class TestCreateTreeJson:
    """Tests for _create_tree_json."""

    def test_single_file_node(self) -> None:
        node = _make_file("app.py", size=512, path_str="src/app.py")
        result = _create_tree_json(node)

        assert result["name"] == "app.py"
        assert result["type"] == "file"
        assert result["path"] == "src/app.py"
        assert result["size"] == 512
        assert result["children"] == []

    def test_directory_with_children(self) -> None:
        child1 = _make_file("main.py", size=200, path_str="src/main.py")
        child2 = _make_file("utils.py", size=300, path_str="src/utils.py")
        parent = _make_dir("src", [child1, child2], size=500)
        result = _create_tree_json(parent)

        assert result["name"] == "src"
        assert result["type"] == "directory"
        assert result["size"] == 500
        assert len(result["children"]) == 2
        assert result["children"][0]["name"] == "main.py"
        assert result["children"][1]["name"] == "utils.py"

    def test_empty_directory(self) -> None:
        node = _make_dir("empty_dir")
        result = _create_tree_json(node)

        assert result["name"] == "empty_dir"
        assert result["type"] == "directory"
        assert result["children"] == []

    def test_symlink_node(self) -> None:
        node = _make_symlink("link.txt", path_str="link.txt")
        result = _create_tree_json(node)

        assert result["name"] == "link.txt"
        assert result["type"] == "symlink"
        assert result["children"] == []

    def test_preserves_file_sizes(self) -> None:
        files = [_make_file(f"f{i}.txt", size=i * 100) for i in range(5)]
        parent = _make_dir("root", files)
        result = _create_tree_json(parent)

        for i, child in enumerate(result["children"]):
            assert child["size"] == i * 100

    def test_deep_nesting(self) -> None:
        leaf = _make_file("deep.py", size=42, path_str="a/b/c/deep.py")
        c_dir = _make_dir("c", [leaf], path_str="a/b/c")
        b_dir = _make_dir("b", [c_dir], path_str="a/b")
        a_dir = _make_dir("a", [b_dir], path_str="a")
        result = _create_tree_json(a_dir)

        assert result["name"] == "a"
        assert result["children"][0]["name"] == "b"
        assert result["children"][0]["children"][0]["name"] == "c"
        assert result["children"][0]["children"][0]["children"][0]["name"] == "deep.py"
        assert result["children"][0]["children"][0]["children"][0]["size"] == 42

    def test_mixed_node_types(self) -> None:
        """Directory containing a file, symlink, and subdirectory."""
        file_node = _make_file("readme.md", size=150)
        link_node = _make_symlink("config")
        sub_dir = _make_dir("lib", [_make_file("helper.py", size=80)])
        root = _make_dir("project", [file_node, link_node, sub_dir])
        result = _create_tree_json(root)

        types = [c["type"] for c in result["children"]]
        assert "file" in types
        assert "symlink" in types
        assert "directory" in types

    def test_result_is_json_serializable(self) -> None:
        """Ensure the output can be serialized to JSON without errors."""
        import json

        node = _make_dir("root", [
            _make_file("a.py", size=100),
            _make_dir("sub", [_make_file("b.py", size=200)]),
        ])
        result = _create_tree_json(node)

        # Should not raise
        serialized = json.dumps(result)
        assert isinstance(serialized, str)

        # Round-trip
        parsed = json.loads(serialized)
        assert parsed["name"] == "root"
        assert len(parsed["children"]) == 2
