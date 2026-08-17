# LULWAH FASHION — Implemented Plan (progress record against `plan.md`)

## 0. Document control

| Field | Value |
|---|---|
| Document | `implemented-plan.md` — records what has actually been built, where, how, and why it may differ from `plan.md` |
| Companion to | [`plan.md`](./plan.md) — the target architecture/spec. This document never restates decisions `plan.md` already covers; it only records implementation reality and deltas. |
| Status | Phase **P0 (Foundation)** complete, per `plan.md` §28's delivery plan. Nothing in P1 onward has been started. |
| As of | 2026-08-17, commit `25ff4f7` |
| Audience | Whoever picks this up next — a future session, a human developer, or the client — needing full context without re-reading the build transcript |

### 0.1 How to read this document

- Section numbers below correspond to `plan.md`'s own section numbers where the mapping is direct (e.g. §4 here discusses `plan.md` §4).
- **Bold status words** — Built, Stubbed, Not started, Deferred — appear throughout; treat them as the source of truth over any prose that might drift.
- §8 ("Bugs found and fixed") is the highest-signal section for anyone extending the frontend — the same bug class (spacing-scale/Tailwind preset) bit multiple files independently and will bite again if not understood.

---

## 1. Status at a glance

| Phase (plan.md §28) | Status |
|---|---|
| **P0 — Foundation** (monorepo, CI, envs, Docker, design tokens, primitives, API skeleton, auth module, seed script) | **Done**, with real bug fixes beyond scaffolding (§8) |
| P1 — Catalogue | Not started (storefront/admin UI exists against **placeholder data only** — see §9) |
| P2 — Commerce (cart, checkout, discount engine, payments, orders) | Not started (UI shells exist, no backend wiring) |
| P3 — Operations (full admin, RBAC enforcement beyond identity, CMS) | Not started, except the order-status state machine (§6) |
| P4 — Experience (GSAP/WebGL, Arabic content, reviews) | Not started |
| P5 — Depth (custom stitching, returns, Aramex, BNPL) | Not started |
| P6 — Hardening | Not started |

**What actually runs today:** `pnpm install && pnpm dev` per app boots a real Express API with working auth against real MongoDB/Redis (in Docker), and two Next.js apps (storefront, admin) with realistic placeholder content. See §10 for exact steps.

---

## 2. Repository & tooling (plan.md §4, §6, §25)

Monorepo initialized as specified: pnpm workspaces + Turborepo, `apps/*` + `packages/*`. Git initialized in this session (repo did not exist before); 27 commits on `master`, no other branches remain (agent worktree branches were merged and deleted).

### 2.1 Versions — deliberately newer than `plan.md`'s original text

`plan.md` v1.1 named specific versions (Next 15, Node 22, MongoDB 7, ...) that had already drifted behind actual current releases by the time this build started. `plan.md` §0's changelog (v1.2) and §4 tables were updated in this session to match; this section just states what's actually installed:

| Component | plan.md v1.1 said | Actually running |
|---|---|---|
| Node | 22 LTS | **24 LTS** (root `package.json` `engines.node: >=24`) |
| Next.js | 15+ | **16.3.x** |
| React | 19 | **19.2.8** |
| MongoDB | 7 | **8** (`mongo:8` image) |
| Mongoose | 8 | **9.9.x** |
| Redis | 7 | **8-alpine** |
| Meilisearch | 1.11 | **1.48** |
| Tailwind CSS | v4 | **4.3.x** |
| TypeScript | (unpinned) | **6.0.x** — deliberately *not* 7.0, which shipped during this build with no stable programmatic API yet; revisit once the ecosystem catches up |
| Vite (transitive, via Vitest/`@vitejs/plugin-react`) | n/a | **8.2.1** — see §8.2, this needed an explicit pin to resolve a cross-app peer conflict |

The local dev machine actually runs **Node 22** (not 24) — `pnpm` prints an `Unsupported engine` warning on every command. Non-blocking; nothing so far has needed a Node-24-only API. Worth installing Node 24 locally before it does.

### 2.2 What's NOT set up

- No GitHub remote exists yet — this is a fully local repo. `.github/workflows/ci.yml` exists and is correct but has never run.
- No `.env` is committed (correctly gitignored); a local dev-only `.env` exists at repo root and in `apps/api/` with placeholder secrets, generated during this session — see §10.

---

## 3. Shared packages — `packages/*` (plan.md §6.1)

All five built, typechecked, linted, and building clean.

| Package | Contains | Notes |
|---|---|---|
| `@lulwah/contracts` | Zod schemas + inferred types for every §32 enum, `Fils` money schema, the §9.1 response envelope + §33 error codes, Product/Variant, Cart, Order (incl. `UpdateOrderStatusInput` from §6.1's own example), User, Address | Not every field from every §7 schema — prioritized fields actually referenced elsewhere in `plan.md` over mechanical transcription. `User` omits security-sensitive fields (`passwordHash`, lockout counters) that must never round-trip to a client. |
| `@lulwah/tokens` | Colors (§13.3), typography (§13.4), spacing (§13.5), motion (§14.2), a generated `tokens.css`, and `assets/` (processed logo files, see §7) | **Spacing scale is missing `0` from `plan.md`'s literal list — see §8.1, this caused a real production-impacting bug.** |
| `@lulwah/config` | `tsconfig.base.json` / `tsconfig.nextjs.json`, flat ESLint config, Prettier config, `tailwind-preset.ts` | The Tailwind preset **replaces** (not extends) `theme.colors/spacing/fontSize/borderRadius/transitionDuration/transitionTimingFunction` — see §8.1 for the consequence. |
| `@lulwah/utils` | `formatMoney(fils, locale)`, UAE phone validation, slug, a Gregorian `Intl.DateTimeFormat` wrapper | |
| `@lulwah/ui` | `Button`, `Input` — Radix-based, hand-styled, zero shadcn skin per §13.2 | Only these two primitives exist; nothing else from §13.6's fuller component list. |

---

## 4. API — `apps/api` (plan.md §5, §9, §10)

Express 5.2 modular monolith. **Only the `identity` module is built** — no catalog, inventory, pricing, cart, checkout, order, payment, shipping, stitching, content, engagement, or analytics module exists yet, not even as stubs. This is the single biggest gap versus `plan.md`'s architecture: the module-boundary lint rule (§5.3) and event system (§5.5) exist in skeleton form but have nothing to enforce boundaries *between* yet.

### 4.1 What's real

- **Auth**: register / login / refresh / logout / logout-all / me, all working against real MongoDB.
  - argon2id hashing (`m=19456, t=2, p=1`) per §10.1.
  - Refresh tokens: rotated every use, `family`-tagged; presenting an already-rotated token revokes the whole family (tested explicitly — this is the one mechanism worth trusting because it's covered, not just written).
  - Account lockout after repeated failed logins.
- **RBAC**: `requirePermission()` middleware + the §10.2 role→permission map, enforced at route and re-checked in the service layer. Only a representative permission subset exists (`orders.status.update`, `products.write`, `settings.write`, a couple more) — not the full §10.2 matrix.
- **OTP and Google sign-in routes exist but return `501`** — explicitly out of scope for this pass, not silently missing.
- Shared infra: Zod-validated `env.ts` (crashes boot on bad config, per §25.3's own rule), Pino logging, Mongo/Redis connection helpers, `AppError` → §9.1 envelope mapping, request-id propagation, a Redis sliding-window rate limiter on `/auth/*`, a `domain-events` BullMQ queue (created, no real consumers yet).

### 4.2 Verified, not just written

31 tests (Vitest + Supertest + `mongodb-memory-server`) covering the auth flows above, plus a live smoke test in this session: real `docker compose` Mongo/Redis, real `pnpm dev`, and an actual `curl` register → login → authenticated `/me` round trip that worked end to end (not the mocked test harness).

### 4.3 `scripts/seed.ts`

Exists as a documented stub only. **No real seed script was written.** Depth went to the identity module's correctness instead, per an explicit scope call made during the build.

---

## 5. Storefront — `apps/web` (plan.md §12–§16)

Next.js 16.3 App Router. Route tree matches `plan.md` §12.1 closely (see the file list in §1 above for exact pages). All routes are **structural + placeholder-data-driven** — none of them call a real API.

### 5.1 What's genuinely built out

- **Home** (`app/[locale]/page.tsx`): the fixed §15.2 section order — Hero, New arrivals rail, Shop by stitching (3 panels), Editorial split, Brand strip, Best sellers, Full-bleed break, Occasion tiles, USP bar, Newsletter — all present, all with real (non-lorem-ipsum) copy in the store's voice.
- **PLP** (`shop/[...category]`): filter rail in the exact §15.3 facet order, 2-up/3-up grid, "Load more" pagination via `nuqs`.
- **PDP** (`product/[slug]`): info-column order per §15.4 — stitching-type pill, colour/size selectors, delivery estimator copy, accordions.
- **`ProductCard`** and **`PriceBlock`**: built to the exact §13.6/§8.2 spec (3:4 media, diagonal clip-path hover wipe, tabular price with garnet `-N%` badge shown only when `discountPercent >= 5`) — unit-tested (10 tests covering the rounding/threshold rules specifically).
- **Header**: real nav, real logo (see §7), scroll-hide behavior. **Not** transparent-over-hero (see §8.4 — this was attempted, found broken, and deliberately simplified to always-solid rather than fixed properly).
- en/ar routing via `next-intl`, RTL logical properties, self-hosted fonts (Bodoni Moda / Archivo / Aref Ruqaa / IBM Plex Sans Arabic) via real Fontsource-sourced files, not placeholders.

### 5.2 Explicitly not built (stated in the original brief, still true)

Mega-menu (four-column crossfading panel), mobile filter bottom-sheet, full brand-history CMS content, GSAP/Lenis/WebGL motion (all R2 per §3.1), real cart/checkout API wiring (UI exists, local component state only), search backed by Meilisearch (no sync job exists), full Arabic translation (representative message keys only).

### 5.3 Custom `next/image` loader gotcha

`lib/image-loader.ts` implements the §4.1 imgproxy-loader pattern, but **no imgproxy container exists in local dev** (`docker-compose.dev.yml` intentionally only runs mongo/redis/meilisearch, per §25.1). The loader now falls back to serving local assets directly when `NEXT_PUBLIC_IMGPROXY_URL` is unset (see §8.3) — this is what makes local image preview possible at all right now.

---

## 6. Admin console — `apps/admin` (plan.md §11)

Next.js 16.3, client-rendered, `noindex`. All 10 §11.1 screens exist as real shells; only **Orders** has real depth.

### 6.1 The one thing built to spec in full: order status (plan.md §8.7)

- `lib/order-status.ts` — `getValidNextStatuses()` encodes the exact §8.7.2 transition table, including both special cases (`out_for_delivery → shipped` as a rollback; `cancelled → refunded`).
- **32 passing unit tests**, one per state/transition combination in §8.7.1/§8.7.2 — this is the most thoroughly tested piece of the whole build.
- `StatusTransitionDropdown` renders *only* what that function returns — invalid transitions are never in the DOM, matching §8.7.4's explicit requirement literally.
- Wired into a real Orders table + detail page with placeholder orders spanning every status, a shipped-requires-tracking mini-form, and an optimistic-update mutation pattern.

### 6.2 Everything else

Products, Inventory, Discounts, Customers, Content, Reports, Settings, Users: page shells exist (sidebar nav, page headers, a reusable `DataTable`), minimal-to-no real content. No RBAC UI beyond the login page's TOTP field (which doesn't verify against anything real).

---

## 7. Brand assets — logo (client-provided, not in `plan.md`)

`logo.png` (repo root) is the client's actual logo — gold "LF" monogram with the pearl, matching §13.1's description exactly, rendered with a glow-on-black treatment.

- **Favicons** (`apps/{web,admin}/app/icon.png`, `apple-icon.png`): extracted via high-pass frequency separation (the glow and the letterforms overlap in brightness, so a plain threshold always left a halo — separating on sharp-detail-vs-smooth-glow instead worked cleanly), given a solid `zamurrad` background chip since a script monogram has no legible linework left at 32px regardless of source quality.
- **Header lockup** (`apps/web/public/brand/logo-lockup-{ink,gold}.png`): same extraction, full monogram+wordmark, two colorways. Only `ink` is actually used right now (see §8.4 — the header is always-solid, so the gold variant, meant for an over-hero state, has no current call site but is kept for when/if that's built properly).
- Master assets kept at `packages/tokens/assets/` for reuse (manifest icons, share images, etc.).

---

## 8. Bugs found and fixed during integration

These weren't in the original agents' work in isolation — they only surfaced once pieces were merged and actually run together, which is exactly why this section exists.

### 8.1 Tailwind spacing scale had no `0` — broke every `-0` utility app-wide

`@lulwah/tokens`'s spacing scale was built literally from §13.5's list (`4 8 12 16 24 32 48 64 96 128 160`), which doesn't mention `0`. Because the Tailwind preset **replaces** `theme.spacing` rather than extending it, `inset-0`, `top-0`, `p-0`, `gap-0` etc. had no value to resolve against and silently generated nothing, anywhere. Concretely: `next/image`'s `fill` layout needs an `absolute inset-0` parent; every `ProductCard` image loaded successfully (200, correct bytes) but rendered at 0×0. Fixed by adding `0` back — it's a structural value, not a design "choice" the locked scale is protecting.

A follow-up scan found **11 more instances of the same bug class**: components written using standard Tailwind's number-as-multiplier convention (`gap-2` expecting 8px, `size-6` expecting 24px, `h-40` expecting 160px) against a scale keyed by raw pixel values. Fixed per-instance based on actual design intent (checked each — touch-target sizing, a hairline grid needing exactly 1px, an image `w-56` matching its own `sizes="56px"` hint) rather than one mechanical substitution. **Any new component using a bare Tailwind spacing number not in `{0,4,8,12,16,24,32,48,64,96,128,160}` will hit this again** — there is no lint rule catching it yet.

### 8.2 `apps/admin` and `apps/web` had incompatible Vitest majors

Admin was pinned to `vitest@^3.2.0` while web/api used `^4.1.10`. `@vitejs/plugin-react@6` (web's test setup) requires `vite@^8`, which `vitest@3`'s hard dependency (`vite: ^5||^6||^7-0`) can't satisfy — pnpm was resolving a single shared `vite@7.3.6` for the whole workspace, leaving web's test suite unable to import `vite`'s `./internal` subpath. Fixed by aligning admin to `vitest@^4.1.10` and adding an explicit `vite@^8.2.1` devDependency to web so pnpm actually resolves the shared copy correctly instead of settling on the lowest mutually-tolerated version.

### 8.3 Every image was permanently broken in local dev

`lib/image-loader.ts` routed *every* image, including plain `/public` assets, through a hardcoded `https://images.lulwahfashion.com` imgproxy origin that doesn't exist (no imgproxy container runs locally). Fixed with a dev-mode fallback that serves local assets directly when `NEXT_PUBLIC_IMGPROXY_URL` is unset.

### 8.4 Header nav/icons were invisible on the homepage

`isTransparent` (true on home, before scroll) switched the header to `bg-transparent text-paper` (white), intended to sit over the dark hero. But the header is `sticky` (in normal document flow, not overlaying anything) — its transparent background just revealed the plain white page background, since the hero starts *after* the header in flow, never behind it. Net effect: white nav links/icons/hamburger on a white page — present in the DOM, completely unreadable. **Fixed by making the header always-solid** rather than building the proper fix (header goes `fixed`, every other route gets compensating top padding, hero is the one exception) — that's a bigger layout change, deferred, and arguably unnecessary since the client's own reference mockup never depicted a transparent-over-hero header anyway.

### 8.5 Healthchecks used `localhost`, resolved to IPv6, always failed

Every `wget`/`fetch`-based healthcheck in the stack (dev Meilisearch; prod web/admin/api; the API's own Dockerfile `HEALTHCHECK`) targeted `localhost`, which resolves to `::1` before `127.0.0.1` on these Alpine images — but every app only binds `0.0.0.0` (IPv4). Reproduced live: Meilisearch sat "unhealthy" with a 31/31 failing streak, all "connection refused," while the identical request against `127.0.0.1` succeeded every time in the same container. This would have made the *production* stack hang on every deploy, since `web`/`admin`/`api` all gate on `depends_on: condition: service_healthy`. Fixed everywhere `localhost` appeared in a healthcheck.

### 8.6 Dev port collisions with the developer's own machine

Docker Mongo/Redis defaulted to the standard `27017`/`6379`, colliding with services the developer already had running locally for unrelated projects (confirmed both collisions live). Moved to `27018`/`6380`; documented why in `docker-compose.dev.yml`'s comments. Separately, `apps/web` and `apps/admin`'s `next dev` scripts had no explicit `-p`, so whichever started first grabbed 3000 and the other bumped to 3001 — observed the swap happen live (admin on 3000, web on 3001). Pinned explicitly.

### 8.7 API never actually loaded its `.env`

`src/shared/env.ts` validates strictly at boot (correct, per §25.3), but nothing loaded a `.env` file into `process.env` — `tsx` doesn't do this automatically, so `pnpm dev` always crashed locally on "missing" config that was sitting right there in `apps/api/.env`. Fixed with Node's native `--env-file-if-exists` flag (not plain `--env-file`, which would crash the *production* container — Docker Compose injects env vars directly, no `.env` file exists on disk there).

---

## 9. Placeholder content — what's real vs. not

**This matters for anyone about to demo this or hand it to the client**: nothing customer-facing is real data yet.

- **Catalogue** (`apps/web/lib/placeholder-data.ts`): 9 hand-written products using **real brand names** (Khaadi, Asim Jofa, Sana Safinaz, Maria B, Gul Ahmed, Elan) with invented article codes, prices, and descriptions. Shaped close to `@lulwah/contracts`' schemas so swapping in a real `apiFetch` later is mechanical, but this is not licensed or client-approved product data.
- **Product/campaign imagery** (`apps/web/public/catalogue/`, `apps/web/public/campaigns/` — 11 + 11 files): royalty-free Unsplash-License fabric/textile macro photography, **deliberately not** scraped photos of the real brands' actual products (that would be unlicensed use of real companies' copyrighted photography) and **deliberately not** real bridal/editorial portraits (likeness concerns, even where the license technically permits reuse). Color-matched to the placeholder product names where sensible. All must be replaced with the client's real photography before launch — this is `plan.md` §29 risk #2, not a new risk.
- **Admin data** (orders, dashboard stats): all hand-written placeholder arrays, no database round-trip.
- **Secrets**: `.env` (root and `apps/api/`) contain dev-only dummy/generated values (random JWT secrets, `devpassword` for Redis). Never committed; never used outside this local machine.

---

## 10. Running it locally

```bash
# 1. Infra (Mongo replica set + Redis + Meilisearch)
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps   # all three should show "healthy"

# 2. Copy env templates if not already present
cp .env.example .env                    # root — used by docker compose
cp apps/api/.env.example apps/api/.env  # then set real JWT_ACCESS_SECRET/JWT_REFRESH_SECRET

# 3. Install + build shared packages
pnpm install
pnpm turbo run build --filter=./packages/*

# 4. Run each app (separate terminals)
pnpm --filter @lulwah/api dev      # http://localhost:4000
pnpm --filter @lulwah/web dev      # http://localhost:3000
pnpm --filter @lulwah/admin dev    # http://localhost:3001

# Full verification
pnpm turbo run typecheck lint test build
```

Mongo is on host port **27018** and Redis on **6380** (not the defaults) — see §8.6.

---

## 11. Suggested next steps

In `plan.md` §28's own order, the next phase is **P1 — Catalogue**: build the `catalog` and `inventory` modules in `apps/api`, wire real product/collection/search endpoints, and swap `apps/web/lib/placeholder-data.ts` for real `apiFetch` calls. Concretely, in priority order:

1. **`catalog` module** (Product/Variant/Category/Brand/Collection Mongoose models + CRUD, per §5.3's layering) — nothing here exists yet; it's the dependency for almost everything else.
2. **Meilisearch sync** — the index config is fully specified in `plan.md` §7.14 and unbuilt.
3. **Admin product editor** — currently just a table shell; §11.1 specs a multi-tab editor that doesn't exist.
4. **Fix the header transparency properly** (§8.4) — low-risk once there's real bandwidth for a layout pass, since the always-solid fallback works fine in the meantime.
5. **A real `pnpm seed` script** — every other phase gets easier with real-shaped seed data instead of hand-written placeholder arrays.
