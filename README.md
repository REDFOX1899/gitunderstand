# GitUnderstand

Convert any GitHub repository into an LLM-friendly text digest and interactive architecture diagram — all in one tool.

**Live at [gitunderstand.com](https://gitunderstand.com)**

## What It Does

1. **Repository Ingestion** — Clones a repo, analyzes the codebase, and produces a structured text digest (Markdown/JSON/XML) optimized for feeding into LLMs.
2. **Architecture Diagrams** — Generates interactive Mermaid diagrams from any public GitHub repository using AI, with clickable nodes linking to source files.
3. **AI Chat** — Ask questions about any repository's architecture using your own API key.

## Architecture

```
                  gitunderstand.com
                        |
              +---------+---------+
              |   Next.js (web)   |   <-- Unified frontend
              |   Port 8080       |
              +---------+---------+
                   /          \
            /diagrams      fallback proxy
                /                \
  +-------------+---+    +------+----------+
  | Diagram Backend |    | Ingestion API   |
  | FastAPI :8000   |    | FastAPI :8080   |
  +--------+--------+    +-------+---------+
           |                      |
     PostgreSQL            Local / GCS Storage
     (diagram cache)       (digests)
```

**Three services:**

| Service | Tech | Port | Purpose |
|---------|------|------|---------|
| `web` | Next.js 15, Tailwind, Drizzle | 8080 | Frontend for both features |
| `backend` | Python FastAPI | 8080 | Repo ingestion + AI summary |
| `diagrams-backend` | Python FastAPI | 8000 | Diagram generation via Claude |

## Quick Start

### Prerequisites

- **Python 3.11+** and `pip`
- **Node.js 20+** and `pnpm`
- **PostgreSQL 15+** (or use Docker)
- **Git**
- API keys: [Anthropic](https://console.anthropic.com/) (required for diagrams/AI)

### Option A: Docker Compose (recommended)

The easiest way to run everything locally:

```bash
# 1. Clone and enter the repo
git clone https://github.com/REDFOX1899/gitunderstand.git
cd gitunderstand

# 2. Copy and fill in environment files
cp .env.example .env
cp diagrams/.env.example diagrams/.env
cp diagrams/backend/.env.example diagrams/backend/.env
# Edit the .env files with your API keys

# 3. Start all services
docker compose up --build

# 4. Open in browser
#    Frontend:    http://localhost:3000
#    Backend API: http://localhost:8080
#    Diagram API: http://localhost:8000
```

### Option B: Run Services Individually

**1. Start PostgreSQL**

```bash
# Using Docker (simplest)
docker run -d --name gitdiagram-db \
  -e POSTGRES_USER=gitdiagram_user \
  -e POSTGRES_PASSWORD=localdev \
  -e POSTGRES_DB=gitdiagram \
  -p 5432:5432 \
  postgres:15-alpine

# Or use your local PostgreSQL installation
```

**2. Ingestion Backend (Python)**

```bash
# Install dependencies
pip install -r requirements.txt

# Copy env file and add your keys
cp .env.example .env

# Run the server
python -m api
# Listening on http://localhost:8080
```

**3. Diagram Backend (Python)**

```bash
cd diagrams/backend

# Install dependencies
pip install -r requirements.txt

# Copy env file and add your Anthropic key
cp .env.example .env

# Run the server
ENVIRONMENT=development uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Listening on http://localhost:8000
```

**4. Next.js Frontend**

```bash
cd diagrams

# Install dependencies
pnpm install

# Copy env file
cp .env.example .env

# Push the database schema
pnpm db:push

# Run the dev server
pnpm dev
# Listening on http://localhost:3000
```

## Common Commands

A `Makefile` is included for convenience:

```bash
make help                  # Show all available commands
make dev                   # Start everything via Docker Compose
make test                  # Run all tests (backend + frontend)
make lint                  # Run all linters
make build                 # Build frontend for production
make db-push               # Push Drizzle schema to PostgreSQL
make clean                 # Remove caches and build artifacts
```

Or run individual services:

```bash
make dev-backend           # Python ingestion API
make dev-diagrams-backend  # Python diagram API
make dev-web               # Next.js frontend
```

## Testing

```bash
# All tests
make test

# Individual test suites
make test-backend           # pytest — ingestion engine (147 tests)
make test-diagrams-backend  # pytest — diagram backend (51 tests)
make test-web               # vitest — frontend unit tests (23 tests)
```

## Environment Variables

| Variable | Service | Required | Description |
|----------|---------|----------|-------------|
| `ANTHROPIC_API_KEY` | diagrams-backend | Yes | Claude API key for diagram generation |
| `CLAUDE_API_KEY` | backend | No | Claude API key for AI summaries/chat |
| `GITHUB_TOKEN` | backend | No | GitHub PAT for private repo access |
| `GITHUB_PAT` | diagrams-backend | No | GitHub PAT (increases rate limit to 5k/hr) |
| `POSTGRES_URL` | web | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_API_DEV_URL` | web | Yes | Diagram backend URL |
| `USE_LOCAL_STORAGE` | backend | No | `true` for local file storage (default) |
| `DEBUG` | backend | No | Enable debug mode |

See `.env.example` files in each service directory for the full list.

## Project Structure

```
.
├── src/                    # Ingestion backend (Python FastAPI)
│   ├── api/                #   FastAPI app, routers, middleware, config
│   ├── core/               #   Ingestion engine, schemas, utilities
│   ├── storage/            #   Abstract storage (local / GCS)
│   └── templates/          #   Jinja2 HTML templates
├── diagrams/               # Next.js frontend + diagram backend
│   ├── src/app/            #   Next.js App Router pages
│   ├── src/components/     #   React components
│   ├── src/server/db/      #   Drizzle ORM schema + client
│   └── backend/            #   Diagram generation backend (Python FastAPI)
│       ├── app/routers/    #     API routes (generate, modify)
│       ├── app/services/   #     Claude + GitHub service classes
│       └── app/prompts.py  #     AI prompt templates
├── tests/                  # Ingestion backend tests
├── static/                 # Frontend static assets (JS, CSS)
├── docker-compose.yml      # Local dev: all services + PostgreSQL
├── Makefile                # Common development commands
└── .github/workflows/      # CI/CD (GitHub Actions)
```

## Deployment

The project deploys to **Google Cloud Run** via GitHub Actions (`.github/workflows/deploy.yml`).

- Push to `main` triggers CI: lint, test, build, deploy
- Path-based filtering: only changed services are redeployed
- Secrets managed via GCP Secret Manager

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on code style, testing, and the PR process.

## License

MIT
