"""Google Cloud Storage backend for digest persistence."""

from __future__ import annotations

import json
import logging
from typing import Any

from storage.base import DigestStorage

logger = logging.getLogger(__name__)


class GCSStorage(DigestStorage):
    """Google Cloud Storage backend for repository digests.

    Stores digests as blobs in a GCS bucket under the path
    ``digests/{digest_id}/digest.txt`` with optional JSON metadata
    stored alongside at ``digests/{digest_id}/metadata.json``.

    On Cloud Run, authentication is handled automatically via
    Application Default Credentials (no API keys required).

    Parameters
    ----------
    bucket_name : str
        The GCS bucket name.
    project_id : str | None
        Optional GCP project ID. If ``None``, the client infers it
        from the environment.

    """

    def __init__(self, bucket_name: str, project_id: str | None = None) -> None:
        from google.cloud import storage  # noqa: PLC0415

        self._client = storage.Client(project=project_id)
        self._bucket = self._client.bucket(bucket_name)
        self._bucket_name = bucket_name

    def _blob_path(self, digest_id: str, filename: str) -> str:
        """Return the GCS object path for a given digest file.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.
        filename : str
            The filename within the digest directory (e.g. ``"digest.txt"``).

        Returns
        -------
        str
            The full object path within the bucket.

        """
        return f"digests/{digest_id}/{filename}"

    def store_digest(self, digest_id: str, content: str, metadata: dict[str, Any] | None = None) -> str:
        """Store a digest to Google Cloud Storage.

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
            The GCS URI of the stored digest (``gs://bucket/path``).

        """
        digest_blob = self._bucket.blob(self._blob_path(digest_id, "digest.txt"))
        digest_blob.upload_from_string(content, content_type="text/plain")
        logger.info("Stored digest at gs://%s/%s", self._bucket_name, digest_blob.name)

        if metadata:
            meta_blob = self._bucket.blob(self._blob_path(digest_id, "metadata.json"))
            meta_blob.upload_from_string(
                json.dumps(metadata, default=str),
                content_type="application/json",
            )
            logger.info("Stored metadata at gs://%s/%s", self._bucket_name, meta_blob.name)

        return f"gs://{self._bucket_name}/{digest_blob.name}"

    def get_digest(self, digest_id: str) -> str | None:
        """Retrieve a digest from Google Cloud Storage.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.

        Returns
        -------
        str | None
            The digest content, or ``None`` if not found.

        """
        blob = self._bucket.blob(self._blob_path(digest_id, "digest.txt"))
        if not blob.exists():
            return None
        return blob.download_as_text()

    def get_metadata(self, digest_id: str) -> dict[str, Any] | None:
        """Retrieve metadata for a digest from Google Cloud Storage.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.

        Returns
        -------
        dict[str, Any] | None
            The metadata dictionary, or ``None`` if not found.

        """
        blob = self._bucket.blob(self._blob_path(digest_id, "metadata.json"))
        if not blob.exists():
            return None
        return json.loads(blob.download_as_text())

    def get_digest_bytes(self, digest_id: str) -> bytes | None:
        """Retrieve raw digest bytes from Google Cloud Storage.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.

        Returns
        -------
        bytes | None
            The raw bytes of the digest content, or ``None`` if not found.

        """
        blob = self._bucket.blob(self._blob_path(digest_id, "digest.txt"))
        if not blob.exists():
            return None
        return blob.download_as_bytes()

    def digest_exists(self, digest_id: str) -> bool:
        """Check if a digest exists in Google Cloud Storage.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.

        Returns
        -------
        bool
            ``True`` if the digest exists, ``False`` otherwise.

        """
        return self._bucket.blob(self._blob_path(digest_id, "digest.txt")).exists()

    def store_summary(self, digest_id: str, summary_type: str, content: str) -> str:
        """Store an AI-generated summary to Google Cloud Storage.

        Parameters
        ----------
        digest_id : str
            Unique identifier for the digest.
        summary_type : str
            The type of summary (e.g. ``"architecture"``).
        content : str
            The summary text content to store.

        Returns
        -------
        str
            The GCS URI of the stored summary.

        """
        blob = self._bucket.blob(self._blob_path(digest_id, f"summary_{summary_type}.txt"))
        blob.upload_from_string(content, content_type="text/plain")
        logger.info("Stored summary at gs://%s/%s", self._bucket_name, blob.name)
        return f"gs://{self._bucket_name}/{blob.name}"

    def get_summary(self, digest_id: str, summary_type: str) -> str | None:
        """Retrieve a cached AI-generated summary from Google Cloud Storage.

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
        blob = self._bucket.blob(self._blob_path(digest_id, f"summary_{summary_type}.txt"))
        if not blob.exists():
            return None
        return blob.download_as_text(encoding="utf-8")
