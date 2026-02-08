"""Module defining the FastAPI router for the home page of the application."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

from api.config import get_settings
from api.shared import EXAMPLE_REPOS, templates

router = APIRouter()
settings = get_settings()


@router.get("/", response_class=HTMLResponse, include_in_schema=False)
async def home(request: Request) -> HTMLResponse:
    """Render the home page with example repositories and default parameters.

    This endpoint serves the home page of the application, rendering the ``index.html`` template
    and providing it with a list of example repositories and default file size values.

    Parameters
    ----------
    request : Request
        The incoming request object, which provides context for rendering the response.

    Returns
    -------
    HTMLResponse
        An HTML response containing the rendered home page template.

    """
    context = {
        "request": request,
        "examples": EXAMPLE_REPOS,
        "default_max_file_size": 243,
    }

    return templates.TemplateResponse("index.html", context)
