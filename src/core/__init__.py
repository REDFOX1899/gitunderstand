"""Core module for GitUnderstand.

Provides the ``ingest`` and ``ingest_async`` entry-points for ingesting
Git repositories and local directories.
"""

from core.entrypoint import ingest, ingest_async

__all__ = ["ingest", "ingest_async"]
