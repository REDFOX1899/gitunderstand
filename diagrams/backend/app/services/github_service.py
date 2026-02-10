import httpx
import jwt
import time
from datetime import datetime, timedelta
import os


class GitHubService:
    def __init__(self, pat: str | None = None, client: httpx.AsyncClient | None = None):
        # Try app authentication first
        self.client_id = os.getenv("GITHUB_CLIENT_ID")
        self.private_key = os.getenv("GITHUB_PRIVATE_KEY")
        self.installation_id = os.getenv("GITHUB_INSTALLATION_ID")

        # Use provided PAT if available, otherwise fallback to env PAT
        self.github_token = pat or os.getenv("GITHUB_PAT")

        # If no credentials are provided, warn about rate limits
        if (
            not all([self.client_id, self.private_key, self.installation_id])
            and not self.github_token
        ):
            print(
                "\033[93mWarning: No GitHub credentials provided. Using unauthenticated requests with rate limit of 60 requests/hour.\033[0m"
            )

        self.access_token = None
        self.token_expires_at = None
        self._client = client

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is not None:
            return self._client
        raise RuntimeError("GitHubService requires an httpx.AsyncClient")

    # autopep8: off
    def _generate_jwt(self):
        now = int(time.time())
        payload = {
            "iat": now,
            "exp": now + (10 * 60),  # 10 minutes
            "iss": self.client_id,
        }
        # Convert PEM string format to proper newlines
        return jwt.encode(payload, self.private_key, algorithm="RS256")  # type: ignore

    # autopep8: on

    async def _get_installation_token(self):
        if self.access_token and self.token_expires_at > datetime.now():  # type: ignore
            return self.access_token

        client = await self._get_client()
        jwt_token = self._generate_jwt()
        response = await client.post(
            f"https://api.github.com/app/installations/{
                self.installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {jwt_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        data = response.json()
        self.access_token = data["token"]
        self.token_expires_at = datetime.now() + timedelta(hours=1)
        return self.access_token

    async def _get_headers(self):
        # If no credentials are available, return basic headers
        if (
            not all([self.client_id, self.private_key, self.installation_id])
            and not self.github_token
        ):
            return {"Accept": "application/vnd.github+json"}

        # Use PAT if available
        if self.github_token:
            return {
                "Authorization": f"token {self.github_token}",
                "Accept": "application/vnd.github+json",
            }

        # Otherwise use app authentication
        token = await self._get_installation_token()
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def _check_repository_exists(self, username, repo):
        """
        Check if the repository exists using the GitHub API.
        """
        client = await self._get_client()
        headers = await self._get_headers()
        api_url = f"https://api.github.com/repos/{username}/{repo}"
        response = await client.get(api_url, headers=headers)

        if response.status_code == 404:
            raise ValueError("Repository not found.")
        elif response.status_code != 200:
            raise Exception(
                f"Failed to check repository: {response.status_code}, {response.json()}"
            )

    async def get_default_branch(self, username, repo):
        """Get the default branch of the repository."""
        client = await self._get_client()
        headers = await self._get_headers()
        api_url = f"https://api.github.com/repos/{username}/{repo}"
        response = await client.get(api_url, headers=headers)

        if response.status_code == 200:
            return response.json().get("default_branch")
        return None

    async def get_github_file_paths_as_list(self, username, repo):
        """
        Fetches the file tree of an open-source GitHub repository,
        excluding static files and generated code.

        Args:
            username (str): The GitHub username or organization name
            repo (str): The repository name

        Returns:
            str: A filtered and formatted string of file paths in the repository, one per line.
        """

        def should_include_file(path):
            # Patterns to exclude
            excluded_patterns = [
                # Dependencies
                "node_modules/",
                "vendor/",
                "venv/",
                # Compiled files
                ".min.",
                ".pyc",
                ".pyo",
                ".pyd",
                ".so",
                ".dll",
                ".class",
                # Asset files
                ".jpg",
                ".jpeg",
                ".png",
                ".gif",
                ".ico",
                ".svg",
                ".ttf",
                ".woff",
                ".webp",
                # Cache and temporary files
                "__pycache__/",
                ".cache/",
                ".tmp/",
                # Lock files and logs
                "yarn.lock",
                "poetry.lock",
                "*.log",
                # Configuration files
                ".vscode/",
                ".idea/",
            ]

            return not any(pattern in path.lower() for pattern in excluded_patterns)

        client = await self._get_client()
        headers = await self._get_headers()

        # Try to get the default branch first
        branch = await self.get_default_branch(username, repo)
        if branch:
            api_url = f"https://api.github.com/repos/{
                username}/{repo}/git/trees/{branch}?recursive=1"
            response = await client.get(api_url, headers=headers)

            if response.status_code == 200:
                data = response.json()
                if "tree" in data:
                    # Filter the paths and join them with newlines
                    paths = [
                        item["path"]
                        for item in data["tree"]
                        if should_include_file(item["path"])
                    ]
                    return "\n".join(paths)

        # If default branch didn't work or wasn't found, try common branch names
        for branch in ["main", "master"]:
            api_url = f"https://api.github.com/repos/{
                username}/{repo}/git/trees/{branch}?recursive=1"
            response = await client.get(api_url, headers=headers)

            if response.status_code == 200:
                data = response.json()
                if "tree" in data:
                    # Filter the paths and join them with newlines
                    paths = [
                        item["path"]
                        for item in data["tree"]
                        if should_include_file(item["path"])
                    ]
                    return "\n".join(paths)

        raise ValueError(
            "Could not fetch repository file tree. Repository might not exist, be empty or private."
        )

    async def get_github_readme(self, username, repo):
        """
        Fetches the README contents of an open-source GitHub repository.

        Args:
            username (str): The GitHub username or organization name
            repo (str): The repository name

        Returns:
            str: The contents of the README file.

        Raises:
            ValueError: If repository does not exist or has no README.
            Exception: For other unexpected API errors.
        """
        # First check if the repository exists
        await self._check_repository_exists(username, repo)

        client = await self._get_client()
        headers = await self._get_headers()

        # Then attempt to fetch the README
        api_url = f"https://api.github.com/repos/{username}/{repo}/readme"
        response = await client.get(api_url, headers=headers)

        if response.status_code == 404:
            raise ValueError("No README found for the specified repository.")
        elif response.status_code != 200:
            raise Exception(
                f"Failed to fetch README: {
                            response.status_code}, {response.json()}"
            )

        data = response.json()
        readme_response = await client.get(data["download_url"])
        readme_content = readme_response.text
        return readme_content
