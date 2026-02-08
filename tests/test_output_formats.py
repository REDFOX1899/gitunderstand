"""Tests for the multi-format output module."""

from __future__ import annotations

import json
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path

from core.output_formats import (
    OutputFormat,
    detect_language,
    format_json,
    format_markdown,
    format_output,
    format_xml,
)
from core.schemas.filesystem import FileSystemNode, FileSystemNodeType
from core.schemas.ingestion import IngestionQuery


def _make_query() -> IngestionQuery:
    """Create a minimal IngestionQuery for testing output formats."""
    return IngestionQuery(
        user_name="testuser",
        repo_name="testrepo",
        local_path=Path("/tmp/testrepo"),
        slug="testuser/testrepo",
        id=uuid.uuid4(),
        branch="main",
        url="https://github.com/testuser/testrepo",
    )


def _make_file_tree(tmp_path: Path) -> FileSystemNode:
    """Create a simple file tree for testing."""
    # Create actual files on disk for content reading
    (tmp_path / "hello.py").write_text("print('hello')")
    (tmp_path / "readme.md").write_text("# Test Repo")

    root = FileSystemNode(
        name="testrepo",
        type=FileSystemNodeType.DIRECTORY,
        path_str="testrepo",
        path=tmp_path,
    )

    file1 = FileSystemNode(
        name="hello.py",
        type=FileSystemNodeType.FILE,
        size=14,
        file_count=1,
        path_str="testrepo/hello.py",
        path=tmp_path / "hello.py",
    )

    file2 = FileSystemNode(
        name="readme.md",
        type=FileSystemNodeType.FILE,
        size=11,
        file_count=1,
        path_str="testrepo/readme.md",
        path=tmp_path / "readme.md",
    )

    root.children = [file1, file2]
    root.file_count = 2
    root.size = 25

    return root


class TestDetectLanguage:
    """Tests for detect_language function."""

    def test_python(self) -> None:
        assert detect_language("src/main.py") == "python"

    def test_javascript(self) -> None:
        assert detect_language("app.js") == "javascript"

    def test_typescript(self) -> None:
        assert detect_language("component.tsx") == "tsx"

    def test_dockerfile(self) -> None:
        assert detect_language("Dockerfile") == "dockerfile"

    def test_makefile(self) -> None:
        assert detect_language("Makefile") == "makefile"

    def test_unknown_extension(self) -> None:
        assert detect_language("file.xyz") == "text"

    def test_html(self) -> None:
        assert detect_language("index.html") == "html"

    def test_yaml(self) -> None:
        assert detect_language("config.yml") == "yaml"
        assert detect_language("config.yaml") == "yaml"

    def test_case_insensitive(self) -> None:
        assert detect_language("Script.PY") == "python"


class TestOutputFormat:
    """Tests for OutputFormat enum."""

    def test_has_all_formats(self) -> None:
        assert OutputFormat.TEXT == "text"
        assert OutputFormat.JSON == "json"
        assert OutputFormat.MARKDOWN == "markdown"
        assert OutputFormat.XML == "xml"


class TestFormatJSON:
    """Tests for JSON output format."""

    def test_produces_valid_json(self, tmp_path: Path) -> None:
        """Output should be valid JSON."""
        node = _make_file_tree(tmp_path)
        query = _make_query()
        token_counts = {"GPT-4o": 100, "Claude": 110}

        result = format_json(node, query, "Test summary", "tree here", token_counts)
        parsed = json.loads(result)

        assert isinstance(parsed, dict)

    def test_json_has_required_fields(self, tmp_path: Path) -> None:
        """JSON should contain repository, summary, tree, files."""
        node = _make_file_tree(tmp_path)
        query = _make_query()
        token_counts = {"GPT-4o": 100}

        result = format_json(node, query, "Test summary", "tree here", token_counts)
        parsed = json.loads(result)

        assert "repository" in parsed
        assert "summary" in parsed
        assert "tree" in parsed
        assert "files" in parsed
        assert "token_counts" in parsed
        assert "file_count" in parsed

    def test_json_files_have_metadata(self, tmp_path: Path) -> None:
        """Each file in JSON should have path, language, size, content."""
        node = _make_file_tree(tmp_path)
        query = _make_query()

        result = format_json(node, query, "summary", "tree", {"GPT-4o": 50})
        parsed = json.loads(result)

        assert len(parsed["files"]) == 2
        for file_entry in parsed["files"]:
            assert "path" in file_entry
            assert "language" in file_entry
            assert "size" in file_entry
            assert "content" in file_entry

    def test_json_detects_language(self, tmp_path: Path) -> None:
        """Python file should be detected as python language."""
        node = _make_file_tree(tmp_path)
        query = _make_query()

        result = format_json(node, query, "summary", "tree", {})
        parsed = json.loads(result)

        py_file = next(f for f in parsed["files"] if f["path"].endswith(".py"))
        assert py_file["language"] == "python"

        md_file = next(f for f in parsed["files"] if f["path"].endswith(".md"))
        assert md_file["language"] == "markdown"


class TestFormatMarkdown:
    """Tests for Markdown output format."""

    def test_contains_header(self, tmp_path: Path) -> None:
        """Markdown should start with a repo header."""
        node = _make_file_tree(tmp_path)
        query = _make_query()

        result = format_markdown(node, query, "summary", "tree", {})

        assert "# testuser/testrepo" in result

    def test_contains_summary_section(self, tmp_path: Path) -> None:
        """Markdown should contain a Summary section."""
        node = _make_file_tree(tmp_path)
        query = _make_query()

        result = format_markdown(node, query, "My summary", "tree", {})

        assert "## Summary" in result
        assert "My summary" in result

    def test_contains_fenced_code_blocks(self, tmp_path: Path) -> None:
        """Markdown should use fenced code blocks with language tags."""
        node = _make_file_tree(tmp_path)
        query = _make_query()

        result = format_markdown(node, query, "summary", "tree", {})

        assert "```python" in result
        assert "```markdown" in result

    def test_contains_file_paths(self, tmp_path: Path) -> None:
        """Markdown should include file paths as headings."""
        node = _make_file_tree(tmp_path)
        query = _make_query()

        result = format_markdown(node, query, "summary", "tree", {})

        assert "### `testrepo/hello.py`" in result
        assert "### `testrepo/readme.md`" in result

    def test_contains_token_table(self, tmp_path: Path) -> None:
        """Markdown should include token count table when counts provided."""
        node = _make_file_tree(tmp_path)
        query = _make_query()
        token_counts = {"GPT-4o": 1500, "Claude": 1600}

        result = format_markdown(node, query, "summary", "tree", token_counts)

        assert "## Token Estimates" in result
        assert "GPT-4o" in result
        assert "Claude" in result


class TestFormatXML:
    """Tests for XML output format."""

    def test_produces_valid_xml(self, tmp_path: Path) -> None:
        """Output should be valid XML."""
        node = _make_file_tree(tmp_path)
        query = _make_query()

        result = format_xml(node, query, "summary", "tree", {"GPT-4o": 100})

        # Should not raise
        ET.fromstring(result.replace('<?xml version="1.0" encoding="UTF-8"?>\n', ""))  # noqa: S314

    def test_xml_has_declaration(self, tmp_path: Path) -> None:
        """XML output should start with XML declaration."""
        node = _make_file_tree(tmp_path)
        query = _make_query()

        result = format_xml(node, query, "summary", "tree", {})

        assert result.startswith('<?xml version="1.0" encoding="UTF-8"?>')

    def test_xml_has_repository_root(self, tmp_path: Path) -> None:
        """XML should have <repository> as root element."""
        node = _make_file_tree(tmp_path)
        query = _make_query()

        result = format_xml(node, query, "summary", "tree", {})
        # Remove XML declaration and parse
        xml_body = result.replace('<?xml version="1.0" encoding="UTF-8"?>\n', "")
        root = ET.fromstring(xml_body)  # noqa: S314

        assert root.tag == "repository"

    def test_xml_has_files_with_attributes(self, tmp_path: Path) -> None:
        """XML files should have path, language, size attributes."""
        node = _make_file_tree(tmp_path)
        query = _make_query()

        result = format_xml(node, query, "summary", "tree", {})
        xml_body = result.replace('<?xml version="1.0" encoding="UTF-8"?>\n', "")
        root = ET.fromstring(xml_body)  # noqa: S314

        files_el = root.find("files")
        assert files_el is not None

        file_elements = files_el.findall("file")
        assert len(file_elements) == 2

        for file_el in file_elements:
            assert "path" in file_el.attrib
            assert "language" in file_el.attrib
            assert "size" in file_el.attrib


class TestFormatOutput:
    """Tests for the format_output dispatcher."""

    def test_text_format_returns_content(self, tmp_path: Path) -> None:
        """TEXT format should return the content string unchanged."""
        node = _make_file_tree(tmp_path)
        query = _make_query()

        result = format_output(
            OutputFormat.TEXT, node, query, "summary", "tree", "my content", {}
        )

        assert result == "my content"

    def test_json_format_returns_json(self, tmp_path: Path) -> None:
        """JSON format should return valid JSON."""
        node = _make_file_tree(tmp_path)
        query = _make_query()

        result = format_output(
            OutputFormat.JSON, node, query, "summary", "tree", "content", {}
        )

        parsed = json.loads(result)
        assert isinstance(parsed, dict)

    def test_markdown_format_returns_markdown(self, tmp_path: Path) -> None:
        """MARKDOWN format should return markdown with headers."""
        node = _make_file_tree(tmp_path)
        query = _make_query()

        result = format_output(
            OutputFormat.MARKDOWN, node, query, "summary", "tree", "content", {}
        )

        assert "# testuser/testrepo" in result

    def test_xml_format_returns_xml(self, tmp_path: Path) -> None:
        """XML format should return XML with declaration."""
        node = _make_file_tree(tmp_path)
        query = _make_query()

        result = format_output(
            OutputFormat.XML, node, query, "summary", "tree", "content", {}
        )

        assert result.startswith('<?xml version="1.0" encoding="UTF-8"?>')
