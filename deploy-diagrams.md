---
description: Deploy gitdiagram as a sub-path feature at githubunderstand.com/diagrams — clones repo, analyzes, adapts, and deploys to GCP
argument-hint: "<phase: clone|analyze|adapt|deploy-backend|deploy-frontend|routing|full>"
---

## Mission

Execute the gitdiagram deployment pipeline for githubunderstand.com/diagrams. This command orchestrates the full workflow across phases.

## Phases

Based on the argument provided, execute the corresponding phase:

### `clone` — Clone and initial setup
1. Clone `https://github.com/ahmedkhaleel2004/gitdiagram.git` into `./diagrams/` directory
2. Run `cd diagrams && pnpm install`
3. List all files that need `.env` configuration
4. Report the tech stack and dependencies found

### `analyze` — Deep analysis of the codebase
Delegate to the **repo-analyzer** agent:
- Map all environment variables
- Find all hardcoded domain references (`gitdiagram.com`)
- Identify all route definitions
- Check backend CORS configuration
- Catalog all API endpoints
- Report findings with file:line references

### `adapt` — Modify code for sub-path deployment
Delegate to the **repo-analyzer** agent:
- Add `basePath: '/diagrams'` to `next.config.js`
- Update all domain references from `gitdiagram.com` to `githubunderstand.com/diagrams`
- Update backend CORS origins
- Update metadata, OG tags, site title
- Create production `.env.production` template
- Verify build succeeds: `cd diagrams && pnpm build`

### `deploy-backend` — Deploy FastAPI to Cloud Run
Delegate to the **gcp-deployer** agent:
- Build backend Docker image
- Push to GCR/Artifact Registry
- Deploy Cloud Run service with secrets
- Verify health endpoint

### `deploy-frontend` — Deploy Next.js to Cloud Run
Delegate to the **gcp-deployer** agent:
- Create production Dockerfile for Next.js (if not exists)
- Build with correct env vars and basePath
- Deploy Cloud Run service
- Verify the app loads

### `routing` — Configure load balancer routing
Delegate to the **gcp-deployer** agent:
- Inspect current routing for githubunderstand.com
- Add URL map rules for `/diagrams/*`
- Verify end-to-end connectivity

### `full` — Run all phases in sequence
Execute clone → analyze → adapt → deploy-backend → deploy-frontend → routing
Pause between phases for user confirmation.

## Required Information

Before starting, confirm the user has:
- [ ] OpenAI API Key
- [ ] GitHub Personal Access Token
- [ ] GCP Project configured (`gcloud config get-value project`)
- [ ] Existing infra details for githubunderstand.com
- [ ] Database preference (new Cloud SQL or existing)

## Error Handling

- If any phase fails, stop and report the error clearly
- Suggest fixes before retrying
- Never proceed to deployment phases if build fails
- Always verify the previous phase succeeded before continuing
