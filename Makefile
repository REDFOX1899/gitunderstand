# ── GitUnderstand Makefile ──
# Run `make help` to see all available commands.

.PHONY: help dev dev-backend dev-diagrams-backend dev-web \
        test test-backend test-diagrams-backend test-web \
        lint lint-backend lint-web build build-web \
        docker-up docker-down db-push db-studio clean

# ── Help ──────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-24s\033[0m %s\n", $$1, $$2}'

# ── Development ───────────────────────────────────────────────
dev: ## Start all services via Docker Compose
	docker compose up --build

dev-backend: ## Run the ingestion backend (Python) locally
	cd src && python -m api

dev-diagrams-backend: ## Run the diagram backend (Python) locally
	cd diagrams/backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

dev-web: ## Run the Next.js frontend locally
	cd diagrams && pnpm dev

# ── Testing ───────────────────────────────────────────────────
test: test-backend test-diagrams-backend test-web ## Run all tests

test-backend: ## Run ingestion backend tests (pytest)
	pytest tests/ -v

test-diagrams-backend: ## Run diagram backend tests (pytest)
	cd diagrams/backend && python -m pytest tests/ -v

test-web: ## Run frontend tests (vitest)
	cd diagrams && pnpm test

# ── Linting ───────────────────────────────────────────────────
lint: lint-backend lint-web ## Run all linters

lint-backend: ## Lint Python code (ruff)
	ruff check src/ tests/

lint-web: ## Lint frontend code (Next.js built-in ESLint)
	cd diagrams && pnpm lint

# ── Building ──────────────────────────────────────────────────
build: build-web ## Build all artifacts

build-web: ## Build the Next.js frontend
	cd diagrams && SKIP_ENV_VALIDATION=1 pnpm build

# ── Docker ────────────────────────────────────────────────────
docker-up: ## Start all services in Docker (detached)
	docker compose up -d --build

docker-down: ## Stop all Docker services
	docker compose down

# ── Database ──────────────────────────────────────────────────
db-push: ## Push Drizzle schema to the database
	cd diagrams && pnpm db:push

db-studio: ## Open Drizzle Studio (database GUI)
	cd diagrams && pnpm db:studio

# ── Cleanup ───────────────────────────────────────────────────
clean: ## Remove build artifacts and caches
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf diagrams/.next diagrams/node_modules/.cache
	@echo "Cleaned build artifacts and caches."
