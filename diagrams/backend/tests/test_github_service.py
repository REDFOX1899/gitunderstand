"""Tests for GitHubService auth fallback and error handling."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx

from app.services.github_service import GitHubService


class TestGitHubServiceInit:
    """Test GitHubService initialization and auth fallback logic."""

    def test_init_with_pat(self):
        """PAT should be used when provided."""
        service = GitHubService(pat="ghp_test123")
        assert service.github_token == "ghp_test123"

    def test_init_with_env_pat(self):
        """Falls back to GITHUB_PAT env var."""
        with patch.dict("os.environ", {"GITHUB_PAT": "ghp_env_token"}, clear=False):
            service = GitHubService()
            assert service.github_token == "ghp_env_token"

    def test_init_no_credentials_logs_warning(self):
        """Should log a warning when no credentials are provided."""
        with patch.dict("os.environ", {}, clear=True):
            with patch("app.services.github_service.logger") as mock_logger:
                service = GitHubService()
                mock_logger.warning.assert_called_once()
                assert "unauthenticated" in mock_logger.warning.call_args[0][0].lower()

    def test_init_pat_overrides_env(self):
        """Explicit PAT should override env var."""
        with patch.dict("os.environ", {"GITHUB_PAT": "ghp_env"}, clear=False):
            service = GitHubService(pat="ghp_explicit")
            assert service.github_token == "ghp_explicit"


class TestGitHubServiceHeaders:
    """Test _get_headers auth method selection."""

    @pytest.mark.asyncio
    async def test_headers_with_pat(self):
        """Should use token auth when PAT is available."""
        client = AsyncMock(spec=httpx.AsyncClient)
        service = GitHubService(pat="ghp_test", client=client)
        headers = await service._get_headers()
        assert headers["Authorization"] == "token ghp_test"
        assert headers["Accept"] == "application/vnd.github+json"

    @pytest.mark.asyncio
    async def test_headers_unauthenticated(self):
        """Should return basic headers when no credentials available."""
        with patch.dict("os.environ", {}, clear=True):
            client = AsyncMock(spec=httpx.AsyncClient)
            service = GitHubService(client=client)
            headers = await service._get_headers()
            assert "Authorization" not in headers
            assert headers["Accept"] == "application/vnd.github+json"


class TestGitHubServiceAPI:
    """Test GitHub API interaction methods."""

    @pytest.mark.asyncio
    async def test_check_repository_exists_404(self):
        """Should raise ValueError for non-existent repos."""
        mock_response = MagicMock()
        mock_response.status_code = 404

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get = AsyncMock(return_value=mock_response)

        service = GitHubService(pat="ghp_test", client=mock_client)
        with pytest.raises(ValueError, match="Repository not found"):
            await service._check_repository_exists("user", "nonexistent")

    @pytest.mark.asyncio
    async def test_check_repository_exists_500(self):
        """Should raise RuntimeError for server errors."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.json.return_value = {"message": "Internal Server Error"}

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get = AsyncMock(return_value=mock_response)

        service = GitHubService(pat="ghp_test", client=mock_client)
        with pytest.raises(RuntimeError, match="GitHub API error"):
            await service._check_repository_exists("user", "repo")

    @pytest.mark.asyncio
    async def test_get_default_branch_success(self):
        """Should return the default branch name."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"default_branch": "develop"}

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get = AsyncMock(return_value=mock_response)

        service = GitHubService(pat="ghp_test", client=mock_client)
        branch = await service.get_default_branch("user", "repo")
        assert branch == "develop"

    @pytest.mark.asyncio
    async def test_get_default_branch_404(self):
        """Should return None when repo not found."""
        mock_response = MagicMock()
        mock_response.status_code = 404

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get = AsyncMock(return_value=mock_response)

        service = GitHubService(pat="ghp_test", client=mock_client)
        branch = await service.get_default_branch("user", "nonexistent")
        assert branch is None

    @pytest.mark.asyncio
    async def test_get_file_paths_filters_excluded(self):
        """Should filter out node_modules, compiled files, etc."""
        tree_data = {
            "tree": [
                {"path": "src/main.py"},
                {"path": "node_modules/package/index.js"},
                {"path": "src/app.pyc"},
                {"path": "src/utils.py"},
                {"path": "assets/logo.png"},
                {"path": "vendor/lib.js"},
            ]
        }

        # First call: get_default_branch, second call: get tree
        branch_response = MagicMock()
        branch_response.status_code = 200
        branch_response.json.return_value = {"default_branch": "main"}

        tree_response = MagicMock()
        tree_response.status_code = 200
        tree_response.json.return_value = tree_data

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get = AsyncMock(side_effect=[branch_response, tree_response])

        service = GitHubService(pat="ghp_test", client=mock_client)
        result = await service.get_github_file_paths_as_list("user", "repo")

        assert "src/main.py" in result
        assert "src/utils.py" in result
        assert "node_modules" not in result
        assert ".pyc" not in result
        assert ".png" not in result
        assert "vendor/" not in result

    @pytest.mark.asyncio
    async def test_get_file_paths_empty_repo(self):
        """Should raise ValueError for empty repos."""
        # All branch attempts fail
        mock_response = MagicMock()
        mock_response.status_code = 404

        # get_default_branch returns None, then main/master attempts fail
        branch_response = MagicMock()
        branch_response.status_code = 404

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get = AsyncMock(return_value=mock_response)

        service = GitHubService(pat="ghp_test", client=mock_client)
        with pytest.raises(ValueError, match="Could not fetch repository file tree"):
            await service.get_github_file_paths_as_list("user", "empty-repo")

    @pytest.mark.asyncio
    async def test_get_client_raises_without_client(self):
        """Should raise RuntimeError if no client provided."""
        service = GitHubService(pat="ghp_test")
        with pytest.raises(RuntimeError, match="requires an httpx.AsyncClient"):
            await service._get_client()
