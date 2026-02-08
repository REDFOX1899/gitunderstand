"""Tests for the storage backends and factory."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, patch

if TYPE_CHECKING:
    from pathlib import Path

from storage.factory import get_storage
from storage.gcs import GCSStorage
from storage.local import LocalStorage


class TestLocalStorage:
    """Tests for the LocalStorage backend."""

    def test_store_and_retrieve(self, tmp_path: Path) -> None:
        """Storing a digest and retrieving it should return the same content."""
        storage = LocalStorage(base_path=str(tmp_path))
        storage.store_digest("abc-123", "hello world")

        result = storage.get_digest("abc-123")
        assert result == "hello world"

    def test_get_nonexistent_digest(self, tmp_path: Path) -> None:
        """Getting a non-existent digest should return None."""
        storage = LocalStorage(base_path=str(tmp_path))
        assert storage.get_digest("does-not-exist") is None

    def test_digest_exists(self, tmp_path: Path) -> None:
        """digest_exists should return True after storing and False before."""
        storage = LocalStorage(base_path=str(tmp_path))
        assert storage.digest_exists("abc-123") is False

        storage.store_digest("abc-123", "content")
        assert storage.digest_exists("abc-123") is True

    def test_store_with_metadata(self, tmp_path: Path) -> None:
        """Storing with metadata should create a metadata.json file."""
        storage = LocalStorage(base_path=str(tmp_path))
        metadata = {"repo_url": "https://github.com/test/repo", "user_name": "test"}
        storage.store_digest("abc-123", "content", metadata=metadata)

        metadata_file = tmp_path / "abc-123" / "metadata.json"
        assert metadata_file.exists()

    def test_get_metadata(self, tmp_path: Path) -> None:
        """get_metadata should return the stored metadata dict."""
        storage = LocalStorage(base_path=str(tmp_path))
        metadata: dict[str, Any] = {"summary": "A test repo", "repo_url": "https://github.com/test/repo"}
        storage.store_digest("abc-123", "content", metadata=metadata)

        result = storage.get_metadata("abc-123")
        assert result is not None
        assert result["summary"] == "A test repo"
        assert result["repo_url"] == "https://github.com/test/repo"

    def test_get_metadata_nonexistent(self, tmp_path: Path) -> None:
        """get_metadata should return None for non-existent digest."""
        storage = LocalStorage(base_path=str(tmp_path))
        assert storage.get_metadata("does-not-exist") is None

    def test_get_digest_bytes(self, tmp_path: Path) -> None:
        """get_digest_bytes should return raw bytes of the digest."""
        storage = LocalStorage(base_path=str(tmp_path))
        storage.store_digest("abc-123", "hello world")

        result = storage.get_digest_bytes("abc-123")
        assert result == b"hello world"

    def test_get_digest_bytes_nonexistent(self, tmp_path: Path) -> None:
        """get_digest_bytes should return None for non-existent digest."""
        storage = LocalStorage(base_path=str(tmp_path))
        assert storage.get_digest_bytes("does-not-exist") is None

    def test_store_returns_path(self, tmp_path: Path) -> None:
        """store_digest should return the path to the stored file."""
        storage = LocalStorage(base_path=str(tmp_path))
        result = storage.store_digest("abc-123", "content")

        assert "abc-123" in result
        assert "digest.txt" in result


class TestGCSStorage:
    """Tests for the GCSStorage backend (all GCS calls mocked)."""

    def _make_storage(self) -> tuple[GCSStorage, MagicMock]:
        """Create a GCSStorage instance with mocked GCS client."""
        with patch("storage.gcs.GCSStorage.__init__", return_value=None):
            storage = GCSStorage.__new__(GCSStorage)

        mock_bucket = MagicMock()
        storage._bucket = mock_bucket  # noqa: SLF001
        storage._bucket_name = "test-bucket"  # noqa: SLF001
        return storage, mock_bucket

    def test_store_digest(self) -> None:
        """store_digest should upload content to the correct blob path."""
        storage, mock_bucket = self._make_storage()
        mock_blob = MagicMock()
        mock_bucket.blob.return_value = mock_blob

        result = storage.store_digest("abc-123", "hello world")

        mock_bucket.blob.assert_any_call("digests/abc-123/digest.txt")
        mock_blob.upload_from_string.assert_called_once_with("hello world", content_type="text/plain")
        assert "gs://test-bucket/" in result

    def test_store_digest_with_metadata(self) -> None:
        """store_digest with metadata should upload both digest and metadata blobs."""
        storage, mock_bucket = self._make_storage()
        mock_blob = MagicMock()
        mock_bucket.blob.return_value = mock_blob

        metadata = {"summary": "test", "repo_url": "https://github.com/test/repo"}
        storage.store_digest("abc-123", "content", metadata=metadata)

        # Should have been called for both digest.txt and metadata.json
        assert mock_bucket.blob.call_count == 2
        calls = [str(c) for c in mock_blob.upload_from_string.call_args_list]
        assert len(calls) == 2

    def test_get_digest(self) -> None:
        """get_digest should download and return text content."""
        storage, mock_bucket = self._make_storage()
        mock_blob = MagicMock()
        mock_blob.exists.return_value = True
        mock_blob.download_as_text.return_value = "hello world"
        mock_bucket.blob.return_value = mock_blob

        result = storage.get_digest("abc-123")
        assert result == "hello world"
        mock_bucket.blob.assert_called_with("digests/abc-123/digest.txt")

    def test_get_digest_not_found(self) -> None:
        """get_digest should return None when blob does not exist."""
        storage, mock_bucket = self._make_storage()
        mock_blob = MagicMock()
        mock_blob.exists.return_value = False
        mock_bucket.blob.return_value = mock_blob

        result = storage.get_digest("does-not-exist")
        assert result is None

    def test_get_metadata(self) -> None:
        """get_metadata should download and parse JSON metadata."""
        storage, mock_bucket = self._make_storage()
        mock_blob = MagicMock()
        mock_blob.exists.return_value = True
        mock_blob.download_as_text.return_value = json.dumps({"summary": "test"})
        mock_bucket.blob.return_value = mock_blob

        result = storage.get_metadata("abc-123")
        assert result is not None
        assert result["summary"] == "test"

    def test_get_metadata_not_found(self) -> None:
        """get_metadata should return None when metadata blob does not exist."""
        storage, mock_bucket = self._make_storage()
        mock_blob = MagicMock()
        mock_blob.exists.return_value = False
        mock_bucket.blob.return_value = mock_blob

        result = storage.get_metadata("does-not-exist")
        assert result is None

    def test_digest_exists_true(self) -> None:
        """digest_exists should return True when blob exists."""
        storage, mock_bucket = self._make_storage()
        mock_blob = MagicMock()
        mock_blob.exists.return_value = True
        mock_bucket.blob.return_value = mock_blob

        assert storage.digest_exists("abc-123") is True

    def test_digest_exists_false(self) -> None:
        """digest_exists should return False when blob does not exist."""
        storage, mock_bucket = self._make_storage()
        mock_blob = MagicMock()
        mock_blob.exists.return_value = False
        mock_bucket.blob.return_value = mock_blob

        assert storage.digest_exists("does-not-exist") is False

    def test_get_digest_bytes(self) -> None:
        """get_digest_bytes should return raw bytes."""
        storage, mock_bucket = self._make_storage()
        mock_blob = MagicMock()
        mock_blob.exists.return_value = True
        mock_blob.download_as_bytes.return_value = b"raw bytes"
        mock_bucket.blob.return_value = mock_blob

        result = storage.get_digest_bytes("abc-123")
        assert result == b"raw bytes"

    def test_get_digest_bytes_not_found(self) -> None:
        """get_digest_bytes should return None when blob does not exist."""
        storage, mock_bucket = self._make_storage()
        mock_blob = MagicMock()
        mock_blob.exists.return_value = False
        mock_bucket.blob.return_value = mock_blob

        result = storage.get_digest_bytes("does-not-exist")
        assert result is None


class TestStorageFactory:
    """Tests for the get_storage() factory function."""

    @patch("api.config.get_settings")
    def test_returns_local_when_configured(self, mock_settings: MagicMock, tmp_path: Path) -> None:
        """Factory should return LocalStorage when use_local_storage is True."""
        mock_settings.return_value = MagicMock(
            use_local_storage=True,
            local_storage_path=str(tmp_path),
        )
        storage = get_storage()
        assert isinstance(storage, LocalStorage)

    @patch("storage.gcs.GCSStorage.__init__", return_value=None)
    @patch("api.config.get_settings")
    def test_returns_gcs_when_configured(
        self, mock_settings: MagicMock, _mock_gcs_init: MagicMock
    ) -> None:
        """Factory should return GCSStorage when use_local_storage is False."""
        mock_settings.return_value = MagicMock(
            use_local_storage=False,
            gcs_bucket_name="test-bucket",
            gcp_project_id="test-project",
        )
        storage = get_storage()
        assert isinstance(storage, GCSStorage)
