# GitDiagram Deployment Plan — gitunderstand.com/diagrams

## Architecture Overview

GitDiagram has two components:
- **Frontend**: Next.js app (TypeScript, Tailwind CSS, ShadCN)
- **Backend**: FastAPI Python server (handles AI diagram generation via OpenAI o4-mini)
- **Database**: PostgreSQL with Drizzle ORM

Your deployment target: GCP, served at `gitunderstand.com/diagrams`

---

## Requirements From You

Before the agents can execute, you need to provide:

### Must-Have
1. **OpenAI API Key** — GitDiagram uses OpenAI o4-mini for diagram generation
2. **GitHub Personal Access Token** — for fetching repo file trees and README content
3. **GCP Project ID** — which GCP project to deploy into
4. **Current infra details** — how is gitunderstand.com currently deployed? (Cloud Run? GKE? Compute Engine? App Engine?) This determines how we integrate the `/diagrams` sub-path
5. **Domain/DNS setup** — who manages DNS for gitunderstand.com? (Cloud DNS, Cloudflare, etc.)
6. **Database preference** — use Cloud SQL (PostgreSQL), or an existing Postgres instance?

### Nice-to-Have
7. **PostHog API key** — if you want analytics (optional)
8. **Rate limiting preferences** — any specific limits for diagram generation?
9. **Existing CI/CD** — do you have GitHub Actions, Cloud Build, or another pipeline?

---

## Phased Plan

### Phase 0: Repo Analysis & Local Validation
- Clone gitdiagram repo into your codebase (as a subdirectory or monorepo module)
- Analyze all env vars needed from `.env.example`
- Validate local build: `pnpm i` → `docker-compose up` → `pnpm dev`
- Identify all hardcoded references to `gitdiagram.com` and plan replacements

### Phase 1: Code Adaptation
- Rebrand/repath: change all routes from `/` root to `/diagrams` sub-path
- Update `next.config.js` with `basePath: '/diagrams'`
- Update all internal links, API calls, and asset paths
- Modify backend CORS settings to allow `gitunderstand.com`
- Update any hardcoded domain references in prompts, metadata, OG tags
- Remove or adapt analytics (PostHog) integration

### Phase 2: Database Setup
- Provision Cloud SQL PostgreSQL instance (or reuse existing)
- Set up `DATABASE_URL` connection string
- Run `pnpm db:push` to initialize schema (Drizzle ORM)
- Test database connectivity

### Phase 3: Backend Deployment (FastAPI)
- Dockerize backend (already has Dockerfile in `backend/`)
- Deploy to Cloud Run as a separate service
- Configure env vars: `OPENAI_API_KEY`, `GITHUB_TOKEN`, `ENVIRONMENT=production`
- Set up internal URL for frontend → backend communication
- Verify `/generate` endpoint works

### Phase 4: Frontend Deployment (Next.js)
- Build Next.js with `basePath: '/diagrams'` and production env vars
- Deploy to Cloud Run (or integrate with existing hosting)
- Set `NEXT_PUBLIC_API_URL` to point to backend Cloud Run service
- Configure the reverse proxy / load balancer to route `gitunderstand.com/diagrams/*` to this service

### Phase 5: Routing & DNS
- Configure your existing load balancer / reverse proxy:
  - `gitunderstand.com/diagrams/*` → GitDiagram frontend service
  - `gitunderstand.com/api/diagrams/*` → GitDiagram backend service (or use internal service-to-service)
- If using Cloud Run with a shared load balancer, add URL map rules
- SSL certificate should already cover `gitunderstand.com`

### Phase 6: Testing & Launch
- End-to-end test: enter a GitHub repo URL → get diagram
- Test private repo flow with GitHub PAT
- Test diagram caching (DB storage)
- Verify click-through interactivity (links to source files)
- Load testing if needed
- Monitor logs via Cloud Logging

---

## Claude Code Agents Setup

### How to Create the Agents

You need 2 subagents. Create them in your project:

```bash
# Option A: Use the /agents command in Claude Code
# 1. Start Claude Code session in your repo
# 2. Type /agents
# 3. Select "Create new agent" → "Project-level"
# 4. Follow prompts for each agent below

# Option B: Manually create the files
mkdir -p .claude/agents
# Then create the two .md files below
```

### Agent 1: `repo-analyzer` — Analyzes and adapts the gitdiagram codebase

Create file: `.claude/agents/repo-analyzer.md`

### Agent 2: `gcp-deployer` — Handles GCP infrastructure and deployment

Create file: `.claude/agents/gcp-deployer.md`

---

## Workflow: How to Use the Agents

```
Step 1: Clone gitdiagram into your repo
  $ git clone https://github.com/ahmedkhaleel2004/gitdiagram.git diagrams

Step 2: Start Claude Code in your repo root
  $ claude

Step 3: Ask the repo-analyzer agent to analyze and adapt
  > "Use the repo-analyzer agent to analyze the gitdiagram code in ./diagrams 
     and adapt it to work under the /diagrams basePath for gitunderstand.com"

Step 4: Provide your env vars when prompted

Step 5: Ask the gcp-deployer agent to deploy
  > "Use the gcp-deployer agent to deploy the diagrams backend and frontend 
     to GCP Cloud Run and configure routing for gitunderstand.com/diagrams"

Step 6: Test and iterate
  > "Test the deployment at gitunderstand.com/diagrams"
```

---

## Key Files to Watch

| File | What to Change |
|------|----------------|
| `next.config.js` | Add `basePath: '/diagrams'`, update rewrites |
| `src/env.js` | Environment variable validation |
| `backend/app/routers/generate.py` | Rate limits, CORS |
| `backend/app/prompts.py` | No changes needed (prompt engineering) |
| `docker-compose.yml` | Production config, remove volume mounts |
| `drizzle.config.ts` | Database connection URL |
| `.env` | All secrets and config |

---

## Risk Mitigation

- **Cost**: OpenAI o4-mini calls cost money. Set rate limits early.
- **GitHub API limits**: Use authenticated requests (PAT) to get 5000 req/hr vs 60.
- **Database**: Cloud SQL costs ~$7-25/month for small instance. Consider Neon or Supabase for free tier.
- **Cold starts**: Cloud Run has cold start latency. Set min instances = 1 for backend if needed.
