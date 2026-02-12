from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
from app.core.limiter import limiter
from typing import cast
from starlette.exceptions import ExceptionMiddleware
from api_analytics.fastapi import Analytics
import httpx
import os

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Shared httpx client for GitHub API calls (connection pooling)
    app.state.http_client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)
    yield
    # Cleanup shared httpx client
    await app.state.http_client.aclose()
    # Cleanup shared aiohttp sessions
    from app.routers.generate import claude_service as gen_claude
    from app.routers.modify import claude_service as mod_claude
    await gen_claude.close()
    await mod_claude.close()


app = FastAPI(lifespan=lifespan)


_default_origins = "https://gitunderstand.com,https://www.gitunderstand.com,http://localhost:3000"
origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

API_ANALYTICS_KEY = os.getenv("API_ANALYTICS_KEY")
if API_ANALYTICS_KEY:
    app.add_middleware(Analytics, api_key=API_ANALYTICS_KEY)

app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded, cast(ExceptionMiddleware, _rate_limit_exceeded_handler)
)

from app.routers import generate, modify  # noqa: E402

app.include_router(generate.router)
app.include_router(modify.router)


@app.get("/")
async def root(request: Request):
    return {"message": "Hello from GitDiagram API!"}


@app.get("/health")
async def health():
    return {"status": "ok"}
