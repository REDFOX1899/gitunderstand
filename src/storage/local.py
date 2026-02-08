"""Local filesystem storage implementation for digests."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from storage.base import DigestStorage

logger = logging.getLogger(__name__)


class LocalStorage(DigestStorage):
    """Local filesystem storage backend for repository digests.

    Stores digests as ``.txt`` files in a directory structure under the configured
    base path, with optional JSON metadata files alongside them.

    Parameters
    ----------
    base_path : str
        The base directory path for storing digests.

    """

    def __init__(self, base_path: str) -> None:
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _digest_dir(self, digest_id: str) -> Path:
        """Return the directory path for a given digest ID.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.

        Returns
        -------
        Path
            The directory path for the digest.

        """
        return self.base_path / digest_id

    def _digest_file(self, digest_id: str) -> Path:
        """Return the file path for a given digest ID.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.

        Returns
        -------
        Path
            The file path for the digest content.

        """
        return self._digest_dir(digest_id) / "digest.txt"

    def _metadata_file(self, digest_id: str) -> Path:
        """Return the metadata file path for a given digest ID.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.

        Returns
        -------
        Path
            The file path for the digest metadata.

        """
        return self._digest_dir(digest_id) / "metadata.json"

    def store_digest(self, digest_id: str, content: str, metadata: dict[str, Any] | None = None) -> str:
        """Store a digest to the local filesystem.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.
        content : str
            The digest text content to store.
        metadata : dict[str, Any] | None
            Optional metadata to store alongside the digest.

        Returns
        -------
        str
            The file path of the stored digest.

        """
        digest_dir = self._digest_dir(digest_id)
        digest_dir.mkdir(parents=True, exist_ok=True)

        digest_file = self._digest_file(digest_id)
        digest_file.write_text(content, encoding="utf-8")
        logger.info("Stored digest at %s", digest_file)

        if metadata:
            metadata_file = self._metadata_file(digest_id)
            metadata_file.write_text(json.dumps(metadata, default=str), encoding="utf-8")
            logger.info("Stored metadata at %s", metadata_file)

        return str(digest_file)

    def get_digest(self, digest_id: str) -> str | None:
        """Retrieve a digest from the local filesystem.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.

        Returns
        -------
        str | None
            The digest content, or ``None`` if not found.

        """
        digest_file = self._digest_file(digest_id)
        if not digest_file.exists():
            return None
        return digest_file.read_text(encoding="utf-8")

    def get_metadata(self, digest_id: str) -> dict[str, Any] | None:
        """Retrieve metadata for a digest.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.

        Returns
        -------
        dict[str, Any] | None
            The metadata dictionary, or ``None`` if not found.

        """
        metadata_file = self._metadata_file(digest_id)
        if not metadata_file.exists():
            return None
        return json.loads(metadata_file.read_text(encoding="utf-8"))

    def digest_exists(self, digest_id: str) -> bool:
        """Check if a digest exists on the local filesystem.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.

        Returns
        -------
        bool
            ``True`` if the digest exists, ``False`` otherwise.

        """
        return self._digest_file(digest_id).exists()
