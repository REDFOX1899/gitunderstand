"""Unit tests for sanitize_mermaid_code and process_click_events."""

from app.routers.generate import sanitize_mermaid_code, process_click_events, ApiRequest
import pytest


# ---------------------------------------------------------------------------
# sanitize_mermaid_code
# ---------------------------------------------------------------------------

class TestSanitizeMermaidCode:
    """Tests for all repair cases inside sanitize_mermaid_code."""

    # 1. Init block removal
    def test_removes_init_block(self):
        code = '%%{init: {"theme": "dark"}}%%\ngraph TD\n  A --> B'
        result = sanitize_mermaid_code(code)
        assert "%%{init" not in result
        assert "graph TD" in result

    def test_removes_multiline_init_block(self):
        code = '%%{init:\n  {"theme":"default",\n  "themeVariables":{"fontSize":"16px"}}\n}%%\ngraph LR\n  X --> Y'
        result = sanitize_mermaid_code(code)
        assert "%%{init" not in result
        assert "graph LR" in result

    # 2. Pipe spacing fixes
    def test_fixes_quoted_pipe_label_with_spaces(self):
        code = 'A -->| "yes" | B'
        result = sanitize_mermaid_code(code)
        assert '-->|"yes"|' in result

    def test_fixes_unquoted_pipe_label_with_spaces(self):
        code = "A -->| some label | B"
        result = sanitize_mermaid_code(code)
        assert '-->|"some label"|' in result

    def test_preserves_correct_pipe_label(self):
        code = 'A -->|"correct"| B'
        result = sanitize_mermaid_code(code)
        assert '-->|"correct"|' in result

    def test_fixes_pipe_with_various_edge_types(self):
        code = 'A ==>| "thick" | B'
        result = sanitize_mermaid_code(code)
        assert '==>|"thick"|' in result

    # 3. Special character quoting in bracket labels
    def test_quotes_bracket_label_with_slash(self):
        code = "A[src/main.py]"
        result = sanitize_mermaid_code(code)
        assert 'A["src/main.py"]' in result

    def test_quotes_bracket_label_with_parens(self):
        code = "A[handler(req)]"
        result = sanitize_mermaid_code(code)
        assert 'A["handler(req)"]' in result

    def test_does_not_double_quote_bracket_label(self):
        code = 'A["already/quoted"]'
        result = sanitize_mermaid_code(code)
        assert 'A["already/quoted"]' in result

    def test_plain_bracket_label_unchanged(self):
        code = "A[Simple Label]"
        result = sanitize_mermaid_code(code)
        assert "A[Simple Label]" in result

    # 3b. Special character quoting in paren labels
    def test_quotes_paren_label_with_special_chars(self):
        code = "A(config/settings.py)"
        result = sanitize_mermaid_code(code)
        assert 'A("config/settings.py")' in result

    def test_does_not_double_quote_paren_label(self):
        code = 'A("already/quoted")'
        result = sanitize_mermaid_code(code)
        assert 'A("already/quoted")' in result

    # 4. Subgraph class removal
    def test_removes_class_from_quoted_subgraph(self):
        code = 'subgraph "Backend":::highlight'
        result = sanitize_mermaid_code(code)
        assert result == 'subgraph "Backend"'

    def test_removes_class_from_unquoted_subgraph(self):
        code = "subgraph Backend:::highlight"
        result = sanitize_mermaid_code(code)
        assert result == "subgraph Backend"

    # 5. Subgraph alias removal
    def test_removes_subgraph_alias(self):
        code = 'subgraph BE "Backend Services"'
        result = sanitize_mermaid_code(code)
        assert result == 'subgraph "Backend Services"'

    # 6. Stripping whitespace
    def test_strips_leading_trailing_whitespace(self):
        code = "\n\n  graph TD\n  A --> B  \n\n"
        result = sanitize_mermaid_code(code)
        assert not result.startswith("\n")
        assert not result.endswith("\n")

    # Combined / realistic
    def test_combined_repairs(self):
        code = (
            '%%{init: {"theme":"neutral"}}%%\n'
            "graph TD\n"
            '  subgraph SVC "Services":::classStyle\n'
            "    A[src/api/handler.py] -->| handles | B(core/engine)\n"
            "  end"
        )
        result = sanitize_mermaid_code(code)
        assert "%%{init" not in result
        assert '["src/api/handler.py"]' in result
        assert '-->|"handles"|' in result
        assert 'subgraph "Services"' in result
        assert ":::classStyle" not in result


# ---------------------------------------------------------------------------
# process_click_events
# ---------------------------------------------------------------------------

class TestProcessClickEvents:
    def test_click_file_path(self):
        diagram = 'click ComponentA "src/main.py"'
        result = process_click_events(diagram, "user", "repo", "main")
        assert result == 'click ComponentA "https://github.com/user/repo/blob/main/src/main.py"'

    def test_click_directory_path(self):
        diagram = 'click ComponentA "src/utils"'
        result = process_click_events(diagram, "user", "repo", "main")
        assert result == 'click ComponentA "https://github.com/user/repo/tree/main/src/utils"'

    def test_multiple_click_events(self):
        diagram = (
            'click A "src/app.py"\n'
            'click B "docs"'
        )
        result = process_click_events(diagram, "owner", "proj", "develop")
        assert "blob/develop/src/app.py" in result
        assert "tree/develop/docs" in result

    def test_no_click_events_unchanged(self):
        diagram = "graph TD\n  A --> B"
        result = process_click_events(diagram, "u", "r", "main")
        assert result == diagram


# ---------------------------------------------------------------------------
# ApiRequest Pydantic model
# ---------------------------------------------------------------------------

class TestApiRequest:
    def test_valid_minimal(self):
        req = ApiRequest(username="user", repo="repo")
        assert req.username == "user"
        assert req.repo == "repo"
        assert req.instructions == ""
        assert req.api_key is None
        assert req.github_pat is None

    def test_valid_full(self):
        req = ApiRequest(
            username="user",
            repo="repo",
            instructions="focus on backend",
            api_key="sk-test",
            github_pat="ghp_test",
        )
        assert req.instructions == "focus on backend"
        assert req.api_key == "sk-test"

    def test_missing_required_field(self):
        with pytest.raises(Exception):
            ApiRequest(username="user")  # missing repo
