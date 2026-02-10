FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.13.0 --activate

# --- Dependencies stage ---
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Build stage ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Skip env validation during build (env vars injected at runtime)
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time arg for rewrite destination (baked into Next.js config at build)
ARG GITUNDERSTAND_API_URL=https://gitunderstand-308289525742.us-central1.run.app
ENV GITUNDERSTAND_API_URL=${GITUNDERSTAND_API_URL}

RUN pnpm build

# --- Production stage ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
