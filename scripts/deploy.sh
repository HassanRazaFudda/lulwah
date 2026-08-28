#!/usr/bin/env bash
# scripts/deploy.sh <env> <tag>
#
# plan.md §36.9's own deploy runbook, materialized as a real, checked-in
# script rather than left as a markdown code block. Run on the VPS, from
# /srv/lulwah, as e.g. `./scripts/deploy.sh production sha-abc1234`.
#
# `docker compose run --rm api node dist/scripts/migrate.js` is the one
# line this script exists to make real — before this file and
# `apps/api/scripts/migrate.ts` existed, nothing anywhere actually ran a
# migration step, and `shared/mongo.ts`'s `autoIndex: false` meant every
# unique index in the system was silently unenforced (see
# `docs/implemented-plan.md` §8.15 for the bug this caused). Migrations
# must be backwards-compatible for one release (add, never rename/drop in
# the same deploy as the code that stops using them) — see this file's
# own comment in plan.md §36.9 on why: `rollback.sh` re-pins to the
# previous image tag without re-running a migration, so the previous
# code must still work against the new schema.
set -euo pipefail

ENVIRONMENT="${1:?Usage: deploy.sh <env> <tag>}"
TAG="${2:?Usage: deploy.sh <env> <tag>}"

cd /srv/lulwah

echo "Deploying $ENVIRONMENT @ $TAG"
# Saved before being overwritten so rollback.sh always has somewhere to
# go back to — see that script's own comment.
[[ -f .tag ]] && cp .tag .tag.previous
echo "TAG=$TAG" > .tag

docker compose --env-file .env --env-file .tag pull
docker compose --env-file .env --env-file .tag run --rm api node dist/scripts/migrate.js

# Rolling: one api replica at a time, wait for healthy before touching the next.
docker compose up -d --no-deps --scale api=2 --wait api
docker compose up -d --no-deps --wait web admin worker

if ! ./scripts/smoke.sh; then
  echo "Smoke test failed — rolling back." >&2
  ./scripts/rollback.sh
  exit 1
fi

if [[ -n "${CF_ZONE:-}" && -n "${CF_TOKEN:-}" ]]; then
  curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/purge_cache" \
       -H "Authorization: Bearer $CF_TOKEN" -H 'Content-Type: application/json' \
       --data '{"purge_everything":false,"tags":["home","nav"]}'
else
  echo "CF_ZONE/CF_TOKEN not set — skipping Cloudflare cache purge." >&2
fi

echo "Deploy of $ENVIRONMENT @ $TAG complete."
