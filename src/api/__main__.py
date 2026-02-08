"""Server module entry point for running with ``python -m api``."""

from __future__ import annotations

import logging
import os

import uvicorn

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")  # noqa: S104
    port = int(os.getenv("PORT", "8080"))
    reload = os.getenv("RELOAD", "false").lower() == "true"

    logger.info("Starting GitUnderstand server on %s:%d", host, port)

    uvicorn.run(
        "api.main:app",
        host=host,
        port=port,
        reload=reload,
    )
