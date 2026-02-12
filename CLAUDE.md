# CLAUDE.md — GitUnderstand

## Project Overview

GitUnderstand converts Git repositories into LLM-friendly text digests. It clones repos, analyzes codebases, and generates structured output (text/JSON/Markdown/XML) optimized for feeding into LLMs. Features include smart chunking, AI-powered summaries via Claude API, and an interactive chat interface.

## Tech Stack

- **Language:** Python 3.11+ (use modern syntax: `list[str]`, `str | None`)
- **Web Framework:** FastAPI (async) with Uvicorn
- **AI:** Anthropic Claude API (`claude-sonnet-4-20250514`)
- **Templating:** Jinja2 + Tailwind CSS (Maia theme — stone + cyan)
- **Frontend:** Vanilla JS (ES6+), SSE for real-time progress
- **Testing:** pytest + pytest-asyncio + pytest-mock
- **Linting:** Ruff (line-length 119)
- **Storage:** Local filesystem or Google Cloud Storage (factory pattern)
- **Config:** pydantic-settings + python-dotenv

## Project Structure

```
src/
├── api/              # FastAPI app, routers, middleware, config
│   ├── main.py       # App init — router order matters (summary before ingest)
│   ├── routers/      # health, index, ingest, summary
│   ├── config.py     # Pydantic BaseSettings (env vars)
│   ├── middleware.py  # Rate limiting + AI quota
│   └── models.py     # Pydantic request/response models
├── core/             # Ingestion engine
│   ├── entrypoint.py # Main ingest/ingest_async entry points
│   ├── schemas/      # Dataclasses: IngestionQuery, FileSystemNode, CloneConfig
│   └── utils/        # Helpers: auth, exceptions, file_utils, git_utils, patterns
├── storage/          # Abstract DigestStorage + local/GCS implementations
└── templates/        # Jinja2 HTML templates
static/js/            # Frontend JavaScript
tests/                # pytest test suite
```

## Commands

```bash
# Run server
python -m api

# Run all tests
pytest

# Run single test file
pytest tests/test_ingestion.py

# Run specific test
pytest tests/test_ingestion.py::TestIngestQuery::test_ingest_basic_directory

# Lint
ruff check src/ tests/

# Lint with auto-fix
ruff check --fix src/ tests/

# Docker
docker-compose up
```

## Code Conventions

- **Imports:** Ruff isort ordering, explicit imports only, `if TYPE_CHECKING:` for circular deps
- **Type hints:** Always. Use modern syntax (`list[str]`, `dict[str, int]`, `str | None`)
- **Docstrings:** NumPy/SciPy style with Parameters, Returns, Raises sections
- **Naming:** modules `snake_case`, classes `PascalCase`, constants `UPPER_CASE`, private `_prefixed`
- **Async:** Use `async def` for I/O-bound operations; sync wrappers call `asyncio.run()`
- **Logging:** `logger = logging.getLogger(__name__)` per module, structured with `extra` dict
- **Error handling:** Custom exceptions in `core.utils.exceptions`, user-friendly messages at API boundaries
- **Settings:** Pydantic `BaseSettings` with `@lru_cache` singleton in `api.config.get_settings()`

## Architecture Notes

- **Router ordering is critical:** Summary router must register before ingest router because ingest has a catch-all route `GET /api/{user}/{repository}`
- **Storage uses factory pattern:** `get_storage()` returns `LocalStorage` or `GCSStorage` based on config
- **Rate limits:** 10/min for ingest, 15/min for chat, 5 AI requests per 6 hours per IP
- **Security:** Symlink validation, path traversal prevention, security headers middleware
- **Chunking:** Smart splitting for repos exceeding LLM context windows
- **Token counting:** Supports GPT-4o, Claude, Gemini, Llama 3

## Environment Variables

Key env vars (see `.env.example` for full list):
- `CLAUDE_API_KEY` — Required for AI summaries/chat
- `GITHUB_TOKEN` — Optional, for private repo access
- `USE_LOCAL_STORAGE` / `LOCAL_STORAGE_PATH` — Storage backend config
- `DEBUG` — Enable debug mode
- `HOST` / `PORT` — Server binding (default `0.0.0.0:8080`)

