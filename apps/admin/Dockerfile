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
# No `COPY .../apps/admin/public` — found live, build-tested: that
# directory exists locally but is completely empty, and git doesn't
# track empty directories at all, so it was never actually committed —
# Coolify's checkout genuinely doesn't have it, and the build fails with
# "not found" trying to copy it. Confirmed nothing in this app's source
# references a `/public`-served static asset (every favicon/icon route
# comes from Next's file-based `app/icon.png` convention instead), so
# there's nothing real to lose by dropping this step.
USER lulwah
ENV HOSTNAME=0.0.0.0
ENV PORT=3901
EXPOSE 3901
# Liveness: admin has no dedicated /health route either — the login page
# is always reachable unauthenticated, so it doubles as the healthcheck
# target. `--timeout=10s`, not 3s — same reasoning as apps/web/Dockerfile:
# a real server-rendered page under `--timeout=3s` can fail the
# healthcheck on ordinary render latency alone.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3901)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/admin/server.js"]
