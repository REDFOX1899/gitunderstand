"""Module containing the dataclasses for the ingestion process."""

from __future__ import annotations

from pathlib import Path  # noqa: TC003 (typing-only-standard-library-import) needed for type checking (pydantic)
from uuid import UUID  # noqa: TC003 (typing-only-standard-library-import) needed for type checking (pydantic)

from pydantic import BaseModel, Field

from core.schemas.cloning import CloneConfig

MAX_FILE_SIZE = 10 * 1024 * 1024  # Maximum size of a single file to process (10 MB)


class IngestionQuery(BaseModel):  # pylint: disable=too-many-instance-attributes
    """Pydantic model to store the parsed details of the repository or file path.

    Attributes
    ----------
    host : str | None
        The host of the repository.
    user_name : str | None
        The username or owner of the repository.
    repo_name : str | None
        The name of the repository.
    local_path : Path
        The local path to the repository or file.
    url : str | None
        The URL of the repository.
    slug : str
        The slug of the repository.
    id : UUID
        The ID of the repository.
    subpath : str
        The subpath to the repository or file (default: ``"/"``).
    type : str | None
        The type of the repository or file.
    branch : str | None
        The branch of the repository.
    commit : str | None
        The commit of the repository.
    tag : str | None
        The tag of the repository.
    max_file_size : int
        The maximum file size to ingest in bytes (default: 10 MB).
    ignore_patterns : set[str]
        The patterns to ignore (default: ``set()``).
    include_patterns : set[str]
        The patterns to include (default: ``set()``).
    include_submodules : bool
        Whether to include all Git submodules within the repository. (default: ``False``)
    gcs_url : str | None
        The GCS URL where the digest is stored if GCS is enabled.

    """

    host: str | None = None
    user_name: str | None = None
    repo_name: str | None = None
    local_path: Path
    url: str | None = None
    slug: str
    id: UUID
    subpath: str = Field(default="/")
    type: str | None = None
    branch: str | None = None
    commit: str | None = None
    tag: str | None = None
    max_file_size: int = Field(default=MAX_FILE_SIZE)
    ignore_patterns: set[str] = Field(default_factory=set)
    include_patterns: set[str] = Field(default_factory=set)
    include_submodules: bool = Field(default=False)
    gcs_url: str | None = None

    def extract_clone_config(self) -> CloneConfig:
        """Extract the relevant fields for the CloneConfig object.

        Returns
        -------
        CloneConfig
            A CloneConfig object containing the relevant fields.

        Raises
        ------
        ValueError
            If the ``url`` parameter is not provided.

        """
        if not self.url:
            msg = "The 'url' parameter is required."
            raise ValueError(msg)

        return CloneConfig(
            url=self.url,
            local_path=str(self.local_path),
            commit=self.commit,
            branch=self.branch,
            tag=self.tag,
            subpath=self.subpath,
            blob=self.type == "blob",
            include_submodules=self.include_submodules,
        )
