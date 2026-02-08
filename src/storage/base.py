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
