#!/usr/bin/env bash
# scripts/rollback.sh
#
# plan.md §36.9: "re-pins .tag to the previous SHA and repeats the rolling
# restart. The last 5 image tags are kept on the box, so a rollback needs
# no network." Deliberately does NOT re-run migrate.js — migrations are
# required to be backwards-compatible for one release specifically so a
# rollback can skip straight to restarting the previous image against the
# (already migrated) current schema.
#
# `.tag.previous` is written by this same script before overwriting `.tag`
# on every deploy that reaches this point, so a rollback always has
# somewhere to go back to; `deploy.sh` never has to know about it.
set -euo pipefail

cd /srv/lulwah

if [[ ! -f .tag.previous ]]; then
  echo "No .tag.previous on disk — nothing to roll back to. Deploy a known-good tag manually with deploy.sh instead." >&2
  exit 1
fi

PREVIOUS_TAG="$(grep -o 'TAG=.*' .tag.previous | cut -d= -f2)"
echo "Rolling back to $PREVIOUS_TAG"

cp .tag .tag.rolled-back-from
mv .tag.previous .tag

docker compose --env-file .env --env-file .tag up -d --no-deps --scale api=2 --wait api
docker compose --env-file .env --env-file .tag up -d --no-deps --wait web admin worker

echo "Rolled back to $PREVIOUS_TAG."
