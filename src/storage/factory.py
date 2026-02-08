"""Storage backend factory for GitUnderstand.

Returns the configured storage backend based on application settings.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from storage.base import DigestStorage


def get_storage() -> DigestStorage:
    """Return the configured storage backend instance.

    Uses ``settings.use_local_storage`` to decide which backend to use:

    - ``True``  → :class:`~storage.local.LocalStorage` (filesystem)
    - ``False`` → :class:`~storage.gcs.GCSStorage` (Google Cloud Storage)

    Returns
    -------
    DigestStorage
        The storage backend instance.

    """
    from api.config import get_settings  # noqa: PLC0415

    settings = get_settings()

    if settings.use_local_storage:
        from storage.local import LocalStorage  # noqa: PLC0415

        return LocalStorage(base_path=settings.local_storage_path)

    from storage.gcs import GCSStorage  # noqa: PLC0415

    return GCSStorage(
        bucket_name=settings.gcs_bucket_name,
        project_id=settings.gcp_project_id,
    )
