# syntax=docker/dockerfile:1
#
# Multi-stage build for @lulwah/web. The build context is the MONOREPO
# ROOT (`docker build -f apps/web/Dockerfile .`), same reasoning as
# apps/api/Dockerfile: pnpm workspaces need the root lockfile and the
# sibling `packages/*` sources to resolve `@lulwah/contracts` /
# `@lulwah/tokens` / `@lulwah/ui` / `@lulwah/utils` / `@lulwah/config`,
# and Coolify's own git-based build flow (not the docker-compose.yml +
# GHCR pipeline plan.md §36 describes) points straight at this file.

# ---- deps ------------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/tokens/package.json packages/tokens/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @lulwah/web...

# ---- build -------------------------------------------------------------
# `--filter @lulwah/web...` builds @lulwah/web plus every workspace
# package it depends on (tokens, contracts, utils, config, ui) first, in
# dependency order — web's own `prebuild` script (`generate:tokens`)
# imports `@lulwah/tokens`'s *compiled* `dist/`, not its TS source, so
# that package must already be built by the time `next build` runs; pnpm's
# `...` filter guarantees that ordering.
FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages ./packages
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @lulwah/web... run build

# ---- runtime -------------------------------------------------------------
# `output: 'standalone'` (next.config.ts) traces only the files actually
# needed at runtime into `.next/standalone` — but in a pnpm-workspace
# monorepo, Next's file-tracing root is the nearest lockfile (the repo
# root here, not apps/web), so that output preserves the full
# `apps/web/...` path inside itself rather than flattening to its own
# root. Standalone also doesn't include static assets or `public/` by
# design (they're meant to be served by a CDN/edge in front of it) — both
# copied in separately below. This is the standard, widely-documented
# shape for a Next.js standalone build inside a pnpm monorepo, not a
# guess specific to this app.
#
# `@swc/helpers` is listed as a direct dependency in apps/web/package.json
# for exactly this image — found by actually *running* this container, not
# just building it: pnpm's strict node_modules isolation means a package
# next needs at runtime purely as SWC-compiled output's own interop helper
# (never imported by name anywhere in this app's source) doesn't reliably
# get pulled into the standalone trace unless something in the workspace
# depends on it directly; without it the container crashed on boot with
# `Cannot find module '.../@swc/helpers/esm/_interop_require_default.js'`.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S lulwah && adduser -S lulwah -G lulwah
COPY --from=build --chown=lulwah:lulwah /repo/apps/web/.next/standalone ./
COPY --from=build --chown=lulwah:lulwah /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=lulwah:lulwah /repo/apps/web/public ./apps/web/public
USER lulwah
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000
# Liveness: the storefront has no dedicated /health route — plan `/en` (a
# real, always-seeded locale route) as the healthcheck target instead.
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/en').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
