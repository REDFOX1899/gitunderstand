"""Storage module for GitUnderstand digest persistence."""

from storage.base import DigestStorage
from storage.local import LocalStorage

__all__ = ["DigestStorage", "LocalStorage"]
