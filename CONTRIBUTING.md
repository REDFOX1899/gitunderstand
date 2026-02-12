# Contributing to GitUnderstand

Thanks for your interest in contributing! This guide covers the code conventions, development workflow, and PR process.

## Development Setup

Follow the [README Quick Start](README.md#quick-start) to get all services running locally.

## Architecture Overview

GitUnderstand is composed of three services:

| Service | Location | Tech | What it does |
|---------|----------|------|-------------|
| Ingestion Backend | `src/` | Python 3.11+ / FastAPI | Clones repos, analyzes code, produces structured digests |
| Diagram Backend | `diagrams/backend/` | Python 3.12 / FastAPI | Generates Mermaid architecture diagrams via Claude |
| Frontend | `diagrams/src/` | Next.js 15 / TypeScript | Unified web UI for both features |

Each service has its own Dockerfile and can be developed independently.

## Code Style

### Python (both backends)

- **Linter:** Ruff (line length 119)
- **Type hints:** Always use them. Prefer modern syntax: `list[str]`, `dict[str, int]`, `str | None`
- **Docstrings:** NumPy/SciPy style with `Parameters`, `Returns`, `Raises` sections
- **Naming:** `snake_case` for modules/functions, `PascalCase` for classes, `UPPER_CASE` for constants
- **Async:** Use `async def` for I/O-bound operations
- **Logging:** `logger = logging.getLogger(__name__)` per module, not `print()`
- **Imports:** Ruff isort ordering; use `if TYPE_CHECKING:` for circular dependency imports

```bash
# Lint
ruff check src/ tests/

# Auto-fix
ruff check --fix src/ tests/
```

### TypeScript / React (frontend)

- **Linter:** ESLint with `@typescript-eslint/stylistic-type-checked`
- **Formatter:** Prettier (via ESLint integration)
- **State management:** React hooks + URL state (no Redux)
- **Components:** Functional components with TypeScript props interfaces
- **Styling:** Tailwind CSS utility classes

```bash
cd diagrams
pnpm lint          # ESLint
pnpm build         # Type-check + lint + build
```

## Testing

### Running Tests

```bash
# All tests
make test

# Individual suites
make test-backend           # pytest — ingestion engine
make test-diagrams-backend  # pytest — diagram backend
make test-web               # vitest — frontend unit tests
```

### Writing Tests

- **Python:** Use `pytest` + `pytest-asyncio`. Place tests in `tests/` (ingestion) or `diagrams/backend/tests/` (diagrams).
- **TypeScript:** Use `vitest`. Place tests alongside source files as `*.test.ts`.
- Mock external APIs (GitHub, Anthropic) — never make real API calls in tests.

## Pull Request Process

1. **Fork and branch** — Create a feature branch from `main`:
   ```bash
   git checkout -b feature/my-change
   ```

2. **Make your changes** — Follow the code style above.

3. **Test locally** — Run the relevant test suite:
   ```bash
   make test
   make lint
   ```

4. **Commit** — Use clear, descriptive commit messages:
   ```
   Add diagram type selector to generation form

   Adds a dropdown to choose between architecture, data flow,
   and dependency diagrams. Updates the prompt template and
   generation endpoint to accept the new parameter.
   ```

5. **Push and open a PR** — Target the `main` branch. The CI pipeline will:
   - Lint Python code with Ruff
   - Run pytest suites for both backends
   - Run vitest for the frontend
   - Build the Next.js frontend
   - Deploy on merge (if CI passes)

6. **PR review** — Address any feedback. Keep PRs focused on a single concern.

## Project Conventions

### Router Ordering (Ingestion Backend)

In `src/api/main.py`, the summary router **must** be registered before the ingest router because ingest has a catch-all route `GET /api/{user}/{repository}`.

### Settings Pattern

Both backends use environment variables loaded via:
- **Ingestion:** `pydantic-settings` with `@lru_cache` singleton (`src/api/config.py`)
- **Diagrams:** `python-dotenv` + `os.getenv()` (`diagrams/backend/app/main.py`)

### Database

- ORM: **Drizzle** (TypeScript, in `diagrams/src/server/db/`)
- Table prefix: `gitdiagram_` (multi-project schema)
- Migrations: `pnpm db:push` (schema push, no migration files)

### Rate Limits

- Ingestion: 10 requests/min per IP
- Chat: 15 requests/min per IP
- AI features: 5 requests per 6-hour window per IP (persisted to disk)

## Questions?

Open an issue or start a discussion on the repository. We're happy to help new contributors get started.
