# syntax=docker/dockerfile:1
#
# Multi-stage build for @lulwah/admin. Build context is the MONOREPO
# ROOT (`docker build -f apps/admin/Dockerfile .`) — same reasoning as
# apps/web/Dockerfile and apps/api/Dockerfile.

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
COPY apps/admin/package.json apps/admin/package.json
RUN pnpm install --frozen-lockfile --filter @lulwah/admin...

# ---- build -------------------------------------------------------------
# `--filter @lulwah/admin...` builds @lulwah/admin plus every workspace
# package it depends on first, in dependency order. Admin's own
# next.config.ts `transpilePackages`s ui/tokens/contracts/utils (compiles
# them from source at Next-bundle time, so those four don't strictly need
# a prior `dist/`), but `@lulwah/config`'s Tailwind preset is imported by
# `tailwind.config.ts` outside that pipeline and does need its own build —
# building all five here (same as web) is simplest and costs nothing extra.
FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages ./packages
COPY --from=deps /repo/apps/admin/node_modules ./apps/admin/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/admin ./apps/admin
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @lulwah/admin... run build

# ---- runtime -------------------------------------------------------------
# Same monorepo standalone-output shape as apps/web/Dockerfile — see that
# file's own comment for why the `apps/admin/...` path is preserved
# rather than flattened, and for why `@swc/helpers` is a direct dependency
# in apps/admin/package.json (this app hit the identical runtime crash).
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S lulwah && adduser -S lulwah -G lulwah
COPY --from=build --chown=lulwah:lulwah /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=lulwah:lulwah /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build --chown=lulwah:lulwah /repo/apps/admin/public ./apps/admin/public
USER lulwah
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
EXPOSE 3001
# Liveness: admin has no dedicated /health route either — the login page
# is always reachable unauthenticated, so it doubles as the healthcheck
# target.
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/admin/server.js"]
