# syntax=docker/dockerfile:1
#
# Multi-stage build for @lulwah/api. The build context is the MONOREPO
# ROOT (`docker build -f apps/api/Dockerfile .`), not apps/api — pnpm
# workspaces need the root lockfile and the sibling `packages/*` sources
# to resolve `@lulwah/contracts` / `@lulwah/utils` / `@lulwah/config`,
# and Turborepo needs the root `turbo.json`. Actual `docker-compose*`
# wiring is a separate workstream (see plan.md §36); this Dockerfile only
# needs to build and run the image standalone.
#
# Requires the repo-root `.dockerignore` to exist — found live,
# build-tested locally (this file had apparently never actually been
# built before; a clean CI checkout has no local `node_modules` to
# trigger this): without it, the `build` stage's `COPY packages
# ./packages` pulls in whatever `node_modules` already exists on the HOST
# (present on any real dev machine, absent only in CI) alongside the real
# source — including its pnpm symlinks, which on this platform resolve to
# absolute host paths (`C:/Code/lulwah/node_modules/...`). Copied into
# this Linux container, that silently overwrites the correct *relative*
# symlinks the `deps` stage had just installed moments earlier with
# dangling ones, so `packages/tokens`'s own `tsc` build step then fails
# with "Cannot find module '.../node_modules/typescript/bin/tsc'" even
# though the file demonstrably exists right before that `COPY` runs.

# ---- deps ------------------------------------------------------------
# `--filter @lulwah/api...` (dots after) selects @lulwah/api plus every
# workspace package it actually depends on (contracts, utils, config,
# tokens — not `ui`, which api doesn't use), so this install only ever
# pulls in what api needs — never `@lulwah/web`'s or `@lulwah/admin`'s
# own (much heavier: Next.js, React) dependency trees. Three separate
# Coolify builds, one per app, must not each install all three apps'
# full dependency graphs just to build one of them.
FROM node:24-alpine AS deps
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/tokens/package.json packages/tokens/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @lulwah/api...

# ---- build -------------------------------------------------------------
# `--filter @lulwah/api...` builds @lulwah/api plus every workspace
# package it depends on (contracts, utils), in dependency order.
FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages ./packages
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @lulwah/api... run build
# Drop everything not needed at runtime (dev deps, TS sources, test files).
RUN pnpm --filter @lulwah/api deploy --prod --legacy /repo/out/api

# ---- runtime -------------------------------------------------------------
# Slim, non-root, no build toolchain. §36.6: MONGODB_URI is expected to be
# a replica-set connection string in every environment, including this
# container — see src/shared/mongo.ts.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S lulwah && adduser -S lulwah -G lulwah
COPY --from=build --chown=lulwah:lulwah /repo/out/api/node_modules ./node_modules
COPY --from=build --chown=lulwah:lulwah /repo/apps/api/dist ./dist
COPY --from=build --chown=lulwah:lulwah /repo/apps/api/package.json ./package.json
USER lulwah
EXPOSE 4000
# Liveness: GET /api/v1/health must return 200 (see src/app.ts).
# 127.0.0.1, not localhost: on this Alpine base, a musl/BusyBox resolver
# has been observed (see docker-compose.yml's healthcheck comments)
# trying localhost's ::1 (IPv6) entry first and getting refused, even
# though the app only binds 0.0.0.0 (IPv4) -- 127.0.0.1 sidesteps the
# whole question. This HEALTHCHECK is overridden by docker-compose.yml's
# own `healthcheck:` block under Compose; it only matters for a bare
# `docker run`.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
