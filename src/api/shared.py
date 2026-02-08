"""Shared objects used across API modules to avoid circular imports."""

from __future__ import annotations

from pathlib import Path

from fastapi.templating import Jinja2Templates

# Templates
templates_dir = Path(__file__).parent.parent / "templates"
templates = Jinja2Templates(directory=templates_dir)

# Example repositories for the home page
EXAMPLE_REPOS: list[dict[str, str]] = [
    {"name": "GitUnderstand", "url": "https://github.com/REDFOX1899/gitunderstand"},
    {"name": "FastAPI", "url": "https://github.com/fastapi/fastapi"},
    {"name": "Flask", "url": "https://github.com/pallets/flask"},
    {"name": "Excalidraw", "url": "https://github.com/excalidraw/excalidraw"},
]
