"""Configuration for the GitUnderstand API server."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file.

    Attributes
    ----------
    host : str
        The host address to bind the server to (default: ``"0.0.0.0"``).
    port : int
        The port to bind the server to (default: ``8080``).
    debug : bool
        Whether to run the server in debug mode (default: ``False``).
    allowed_hosts : str
        Comma-separated list of allowed hosts (default: ``"localhost,127.0.0.1"``).
    use_local_storage : bool
        Whether to use local filesystem storage (default: ``True``).
    local_storage_path : str
        Path for local digest storage (default: ``"/tmp/gitunderstand"``).
    gcp_project_id : str
        GCP project ID (default: ``"gitunderstand"``).
    gcs_bucket_name : str
        GCS bucket name for digest storage (default: ``"gitunderstand-digests"``).
    github_token : str
        Default GitHub token for API access (default: ``""``).
    default_file_size_kb : int
        Default maximum file size in KB (default: ``5120``).
    max_file_size_kb : int
        Maximum allowed file size in KB (default: ``102400``).

    """

    model_config = SettingsConfigDict(env_file=".env")

    host: str = "0.0.0.0"  # noqa: S104
    port: int = 8080
    debug: bool = False
    allowed_hosts: str = "localhost,127.0.0.1"
    use_local_storage: bool = True
    local_storage_path: str = "/tmp/gitunderstand"  # noqa: S108
    gcp_project_id: str = "gitunderstand"
    gcs_bucket_name: str = "gitunderstand-digests"
    github_token: str = ""
    claude_api_key: str = ""
    default_file_size_kb: int = 5120
    max_file_size_kb: int = 102400


def get_settings() -> Settings:
    """Return the application settings instance.

    Returns
    -------
    Settings
        The application settings.

    """
    return Settings()
