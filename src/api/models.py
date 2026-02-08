"""Pydantic models for the API request/response types."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field, field_validator

from api.config import get_settings

_settings = get_settings()


class PatternType(StrEnum):
    """Enumeration for pattern types used in file filtering."""

    INCLUDE = "include"
    EXCLUDE = "exclude"


class IngestRequest(BaseModel):
    """Request model for the ``/api/ingest`` endpoint.

    Attributes
    ----------
    input_text : str
        The Git repository URL or slug to ingest.
    max_file_size : int
        Maximum file size in KB for filtering files.
    pattern_type : PatternType
        Type of pattern to use for file filtering (include or exclude).
    pattern : str
        Glob/regex pattern string for file filtering.
    token : str | None
        GitHub personal access token (PAT) for accessing private repositories.

    """

    input_text: str = Field(..., description="Git repository URL or slug to ingest")
    max_file_size: int = Field(
        default=_settings.default_file_size_kb,
        ge=1,
        le=_settings.max_file_size_kb,
        description="File size in KB",
    )
    pattern_type: PatternType = Field(
        default=PatternType.EXCLUDE,
        description="Pattern type for file filtering",
    )
    pattern: str = Field(default="", description="Glob/regex pattern for file filtering")
    token: str | None = Field(default=None, description="GitHub PAT for private repositories")

    @field_validator("input_text")
    @classmethod
    def validate_input_text(cls, v: str) -> str:
        """Validate that ``input_text`` is not empty."""
        if not v.strip():
            err = "input_text cannot be empty"
            raise ValueError(err)
        v = v.strip()
        if v.endswith(".git"):
            v = v[:-4]
        return v

    @field_validator("pattern")
    @classmethod
    def validate_pattern(cls, v: str) -> str:
        """Validate ``pattern`` field."""
        return v.strip()


class IngestSuccessResponse(BaseModel):
    """Success response model for the ``/api/ingest`` endpoint.

    Attributes
    ----------
    repo_url : str
        The original repository URL that was processed.
    short_repo_url : str
        Short form of repository URL (user/repo).
    summary : str
        Summary of the ingestion process including token estimates.
    digest_url : str
        URL to download the full digest content.
    tree : str
        File tree structure of the repository.
    content : str
        Processed content from the repository files.
    default_max_file_size : int
        The file size slider position used.
    pattern_type : str
        The pattern type used for filtering.
    pattern : str
        The pattern used for filtering.

    """

    repo_url: str = Field(..., description="Original repository URL")
    short_repo_url: str = Field(..., description="Short repository URL (user/repo)")
    summary: str = Field(..., description="Ingestion summary with token estimates")
    digest_url: str = Field(..., description="URL to download the full digest content")
    tree: str = Field(..., description="File tree structure")
    content: str = Field(..., description="Processed file content")
    default_max_file_size: int = Field(..., description="File size slider position used")
    pattern_type: str = Field(..., description="Pattern type used")
    pattern: str = Field(..., description="Pattern used")


class IngestErrorResponse(BaseModel):
    """Error response model for the ``/api/ingest`` endpoint.

    Attributes
    ----------
    error : str
        Error message describing what went wrong.

    """

    error: str = Field(..., description="Error message")


# Union type for API responses
IngestResponse = IngestSuccessResponse | IngestErrorResponse
