"""Abstract base class for digest storage backends."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class DigestStorage(ABC):
    """Abstract base class for digest storage backends.

    All storage implementations must implement these methods to provide
    a consistent interface for storing and retrieving repository digests.
    """

    @abstractmethod
    def store_digest(self, digest_id: str, content: str, metadata: dict[str, Any] | None = None) -> str:
        """Store a digest and return the storage location/URL.

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
            The storage location or URL of the stored digest.

        """

    @abstractmethod
    def get_digest(self, digest_id: str) -> str | None:
        """Retrieve a digest by its ID.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.

        Returns
        -------
        str | None
            The digest content, or ``None`` if not found.

        """

    @abstractmethod
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

    @abstractmethod
    def get_digest_bytes(self, digest_id: str) -> bytes | None:
        """Retrieve the raw bytes of a digest.

        Useful for streaming downloads where text decoding is not needed.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.

        Returns
        -------
        bytes | None
            The raw bytes of the digest content, or ``None`` if not found.

        """

    @abstractmethod
    def digest_exists(self, digest_id: str) -> bool:
        """Check if a digest exists in storage.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.

        Returns
        -------
        bool
            ``True`` if the digest exists, ``False`` otherwise.

        """

    @abstractmethod
    def store_summary(self, digest_id: str, summary_type: str, content: str) -> str:
        """Store an AI-generated summary for a digest.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.
        summary_type : str
            The type of summary (e.g. ``"architecture"``, ``"code_review"``).
        content : str
            The summary text content to store.

        Returns
        -------
        str
            The storage location of the stored summary.

        """

    @abstractmethod
    def get_summary(self, digest_id: str, summary_type: str) -> str | None:
        """Retrieve a cached AI-generated summary.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.
        summary_type : str
            The type of summary to retrieve.

        Returns
        -------
        str | None
            The summary content, or ``None`` if not found.

        """
