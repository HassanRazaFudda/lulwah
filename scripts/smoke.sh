#!/usr/bin/env bash
# scripts/smoke.sh
#
# plan.md §36.9: run by deploy.sh right after the rolling restart, non-zero
# exit on any failure triggers an automatic rollback.sh. Checks, in order:
# API health, the homepage (200 + contains the wordmark), a known product
# page, the products list API, and the admin login page.
#
# `DOMAIN` comes from the same root `.env` docker-compose already reads
# (`DOMAIN=lulwah.ae`, plan.md §36.4) — defaulted here only so this script
# is still runnable standalone against a local/staging box without editing
# it. `SMOKE_PRODUCT_SLUG` names one real, always-published product to
# check the PDP with; set it in `.env` once real catalog content is live
# (the seeded dev catalog's slugs are not stable enough to hardcode here).
set -euo pipefail

DOMAIN="${DOMAIN:-lulwah.ae}"
SMOKE_PRODUCT_SLUG="${SMOKE_PRODUCT_SLUG:-}"
FAILURES=0

check() {
  local description="$1" url="$2" expected_status="${3:-200}"
  local status
  status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" || echo "000")"
  if [[ "$status" == "$expected_status" ]]; then
    echo "OK   $description ($url -> $status)"
  else
    echo "FAIL $description ($url -> $status, expected $expected_status)" >&2
    FAILURES=$((FAILURES + 1))
  fi
}

check "API health" "https://api.$DOMAIN/api/v1/health"

homepage_body="$(curl -s --max-time 10 "https://$DOMAIN/")"
if [[ "$homepage_body" == *"Lulwah"* ]]; then
  echo "OK   Homepage contains the wordmark"
else
  echo "FAIL Homepage does not contain the wordmark 'Lulwah'" >&2
  FAILURES=$((FAILURES + 1))
fi

if [[ -n "$SMOKE_PRODUCT_SLUG" ]]; then
  check "Known product page" "https://$DOMAIN/en/product/$SMOKE_PRODUCT_SLUG"
else
  echo "SKIP Known product page — SMOKE_PRODUCT_SLUG not set" >&2
fi

products_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://api.$DOMAIN/api/v1/products?limit=1")"
if [[ "$products_status" == "200" ]]; then
  echo "OK   Products API ($products_status)"
else
  echo "FAIL Products API (-> $products_status, expected 200)" >&2
  FAILURES=$((FAILURES + 1))
fi

check "Admin login page" "https://admin.$DOMAIN/login"

if [[ "$FAILURES" -gt 0 ]]; then
  echo "$FAILURES smoke check(s) failed." >&2
  exit 1
fi

echo "All smoke checks passed."
