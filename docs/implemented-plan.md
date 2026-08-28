# LULWAH FASHION — Implemented Plan (progress record against `plan.md`)

## 0. Document control

| Field | Value |
|---|---|
| Document | `implemented-plan.md` — records what has actually been built, where, how, and why it may differ from `plan.md` |
| Companion to | [`plan.md`](./plan.md) — the target architecture/spec. This document never restates decisions `plan.md` already covers; it only records implementation reality and deltas. |
| Status | Phase **P0 (Foundation)**, **P1 (Catalogue)**, **P2 (Commerce)**, and **P3 (Operations)** complete, per `plan.md` §28's delivery plan. P3 also carried a client-directed mid-build change: the primary card gateway switched from Stripe to **Ziina** (see §4.6.4, §31‑Q15 of `plan.md`). |
| As of | 2026-08-28, commit `9837c3a` |
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
| **P1 — Catalogue** (catalog + inventory modules, admin product editor, media, taxonomy seed, PLP + facets + search, PDP) | **Done** — real `catalog`/`inventory` API modules, storefront and admin both wired to them, real seed data (§4.4, §5, §6) |
| **P2 — Commerce** (cart, checkout, discount engine, payments, orders) | **Done, API and both frontends.** `cart`/`pricing`/`address` (commit `abe5075`) plus `checkout`/`order`/`payment` (commit `61119c5`, §4.6): the full §8.7 status state machine, guest + card + COD checkout, idempotent order placement. `apps/web`'s cart/checkout is now a real TanStack-Query client over this API (commit `8cc9ab2`, §5.4) and `apps/admin`'s Orders screen is real CRUD against it (commit `38d167b`, §6.4). A real cross-app contract bug (`OrderShippingMethod.id`) found during that wiring was fixed at the source (commit `ce49319`, §8.12). |
| **P3 — Operations** (full admin, RBAC enforcement beyond identity, CMS, reports, audit log) | **Done.** Six new API modules (`audit`, `customer`, `content`, `report`, `settings`, plus the `payment` module's Stripe→**Ziina** gateway swap and order refunds — §4.6.4/§4.7) and six real admin screens (Discounts, Customers, Content, Reports, Settings+Users, plus a new Audit log screen and refund/notes/CSV additions to Orders — §6.5–§6.11) replace every remaining placeholder shell from P0/P1/P2. A pre-existing, cross-cutting infrastructure gap (unique indexes never actually built on any real database — §8.15) was found and fixed along the way. |
| P4 — Experience (GSAP/WebGL, Arabic content, reviews) | Not started |
| P5 — Depth (custom stitching, returns, Aramex, BNPL) | Not started |
| P6 — Hardening | Not started |

**What actually runs today:** `pnpm install && pnpm dev` per app boots a real Express API covering every module `plan.md` specifies through P3 — auth/RBAC (P0), the full product/brand/category/collection/inventory catalog (P1), the full commerce path (P2: cart → checkout → order, §8.7 state machine enforced server-side, card payment via Ziina's hosted-redirect flow or COD), and the full operations layer (P3: audit log, customer profiles, homepage/CMS content, reports, store settings, refunds). Both frontends are real clients of it: the **storefront** renders real seeded products end to end and a customer can add to cart, check out, verify a COD OTP, and place a real order. The **admin console** now has real depth on every one of `plan.md` §11.1's eleven screens — a manager can find an order, refund it, move it through its real status history; a merchandiser can build a homepage section, create a banner, run a Sales report and export it to CSV; every mutating admin action is captured in a real, filterable audit log. Ziina card payment is code-complete but unverified against a live account (no real Ziina API key exists for this project yet — see §4.6.4). See §10 for exact steps.

---

## 2. Repository & tooling (plan.md §4, §6, §25)

Monorepo initialized as specified: pnpm workspaces + Turborepo, `apps/*` + `packages/*`. Git initialized in this session (repo did not exist before); 69 commits on `master` as of P3, no other branches remain (agent worktree branches were merged and deleted after each merge — twelve for P3 alone, six per stage).

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
- No `.env` is committed (correctly gitignored); a local dev-only `.env` exists at repo root, in `apps/api/`, and in `apps/web/` with placeholder secrets — see §10.

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

Express 5.2 modular monolith. **`identity`, `catalog`, `inventory`, `cart`, `pricing`, `checkout`, `order`, `payment`, `audit`, `customer`, `content`, `report`, and `settings` modules are all built** — thirteen modules total (this document's §4.1–§4.5 predate `cart`/`pricing`, which landed as commit `abe5075`; §4.6 covers `checkout`/`order`/`payment` as first built plus the P3 Stripe→Ziina swap; §4.7 covers the five P3 modules `audit`/`customer`/`content`/`report`/`settings`). No stitching or engagement module exists yet, not even as a stub — those are P5/R2 scope. The module-boundary lint rule (§5.3) now has real cross-module boundaries to enforce across thirteen live modules — §4.6.6 and §4.7's own subsections list the specific narrow extensions each update made to other modules' own exported service surfaces to reach across them correctly.

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

### 4.3 `scripts/seed.ts` and `scripts/reindex.ts`

Both real now. `pnpm --filter @lulwah/api seed` clears and reseeds: the full §7.4 category tree (46 categories), the 6 brands the storefront's placeholder data already assumed (Khaadi, Asim Jofa, Sana Safinaz, Maria B, Gul Ahmed, Elan), 33 products across all 4 stitching types with real variants/inventory, 3 collections, and a `super_admin` user. It then triggers a Meilisearch reindex — `pnpm --filter @lulwah/api reindex` does the same rebuild standalone. Idempotent (safe to rerun).

### 4.4 Catalog & inventory (plan.md §5.3, §7.3–§7.9, §9.2, §9.7)

- **Models**: Brand, Category (tree, `parentId`/`path`), Collection (manual `productIds` only — rule-based automated collections per §7.9 not built), Product (the Pakistani-fashion fields — `stitchingType`, `pieceCount`, `pieces[]`, `fabric`, `work[]`, `dupattaType`, `occasion[]`, `season`, `colorName`/`colorFamily`/`colorHex`, `articleCode` — are all there and indexed), Variant. Stock is correctly NOT on Variant — single source of truth is `inventory`, per the plan's explicit rule.
- **Public endpoints** (no auth): `GET /products` (facet-filtered: category/brand/collection/stitchingType/fabric/work/occasion/colorFamily/size/price/inStock/onSale, sort, pagination), `/products/:slug` (full PDP payload — product + live per-variant availability + brand + breadcrumbs), `/products/:slug/related`, `/collections[/:slug]`, `/brands[/:slug]`, `/categories/tree`, `/search`.
- **Admin endpoints** (RBAC via `requireCatalogRead()`/`requireCatalogWrite()`, reusing identity's `requirePermission()`): full CRUD on products (+ variants + media), brands, categories, collections.
- **Inventory**: `InventoryItem` (`onHand`/`reserved`/`available`, the last two always 0/onHand until a cart module exists to reserve against), append-only `StockMovement` audit trail — stock is never bare-`$set`, every change writes a movement, enforced in the service layer and tested. `GET /admin/inventory` (low/out-of-stock filters, search), `POST /admin/inventory/:variantId/adjust` (mandatory reason). Stock changes propagate to the parent product's denormalized `totalStock`/`inStock` via a targeted update.
- **What's deliberately NOT here**: the Redis-locked cart-reservation flow from §8.4 — that's P2 scope, tied to a `cart` module that doesn't exist; building it against nothing would have been premature. No discount engine, so `effectivePriceFils` is just the base/variant price with no discount step applied (nothing to apply yet).
- **Meilisearch sync**: `catalog.events.ts` publishes `product.published`/`product.updated`/`collection.launched`; a BullMQ job syncs to Meilisearch using the exact §7.14 index config (searchable/filterable/sortable attributes, ranking rules, synonyms — copied verbatim from the plan). `GET /search` falls back to a Mongo regex query if Meilisearch is unreachable, per §7.14's explicit "search must never 500" rule — both paths verified working live.
- **Category-filtering nuance worth knowing**: `GET /products?category=` exact-matches one category id, but real nav links (`/shop/unstitched`, `/shop/formal-wedding`, ...) point at **parent** taxonomy nodes while products are tagged with **leaf** categories only. The storefront's PLP resolves this by expanding a requested category to its full descendant-id set before filtering (see `apps/web/lib/plp-data.ts`) — the API itself does the exact single-id match the DTO says it does; the expansion is a storefront-side concern. Worth knowing if a future admin feature or another consumer calls this endpoint directly with a parent category and gets zero results.

### 4.5 Verified, not just written

54 API tests (Vitest + Supertest + `mongodb-memory-server`): the 31 from §4.2 plus facet filtering, PDP availability, the stock-adjustment audit trail (including the negative-stock rejection case), and a mocked-Meilisearch sync test. Live-verified beyond the test suite, against this repo's actual Docker dev stack: seeding populated real Mongo, reindexing populated real Meilisearch (confirmed via direct query), and a live HTTP session exercised admin login, facet-filtered listing, PDP, live search, and a real stock adjustment with movement + `totalStock` propagation confirmed by direct query. Re-confirmed independently in a later session: `GET /brands`, `/products`, `/products/:slug`, `/search?q=` all checked live against the seeded data and rendering correctly end to end through the storefront.

### 4.6 Checkout, order, and payment (plan.md §7.11, §8.6–§8.9, §9.5–§9.6, §20 — P2's second half)

Three new modules: `checkout`, `order`, `payment`. `cart`/`pricing`/`identity`/`catalog`/`inventory` (P2's first half + P1) are consumed through their exported service functions only, per §5.3 — see §4.6.6 for the handful of narrow, deliberate extensions made to those modules' own files (all in the same spirit as the previous phase's `reserveStock`/`releaseStock` addition to `inventory`).

#### 4.6.1 Order — the state machine, the plan's own headline feature

`order.transitions.ts` is a byte-for-byte mirror of `apps/admin/lib/order-status.ts`'s transition table (the file `admin` already had, fully built and tested per §6.1) — both special cases included (`out_for_delivery → shipped` rollback; `cancelled → refunded` only). No shared package links the two copies (`apps/admin` is a Next app, not something `apps/api` imports), so this file's own test (`order.transitions.test.ts`) is exhaustive: all 144 `(from, to)` pairs across the twelve statuses, matching admin's 32-case suite's own thoroughness for the same table. `super_admin` may force any transition outside the table, but only with a mandatory `note` (enforced, not just documented — a missing reason is `400 VALIDATION_FAILED`, not silently allowed); every other role gets `409 INVALID_STATUS_TRANSITION`.

Side effects per transition (§8.7.3) run through a small async-aware event bus (`order.events.ts`) rather than inline in the transition function — a deliberate, documented adaptation of the `cart.events.ts`/`catalog.events.ts` pattern: those buses are fire-and-forget because their real subscribers are async BullMQ bridges; order confirmation's side effects (stock commit, invoice number, discount usage, `soldCount`) are correctness-critical and must complete before the HTTP response, so this bus's `publish()` is awaited by the caller. On → `confirmed`: `inventory`'s reservation is converted to a real `sale` stock movement (`onHand -= qty`, `reserved -= qty` — the actual §8.4 rule, not just a reservation release), an `INV-<orderNumber>` invoice number is set (internal-only field — `@lulwah/contracts`' `Order` has no `invoiceNumber` field, a documented interpretation, not a literal transcription), each referenced discount's `usage.usedCount` is incremented once per order (not once per line), and each ordered product's `soldCount` is incremented. On → `cancelled`: if the sale had already been committed (order reached `confirmed`), stock is physically restocked via a new `adjustment` movement (not a reservation release — there is no reservation left by then); if not, the plain cart-style `releaseStock` path is used. Discount usage is given back either way. On → `delivered`: `deliveredAt` is set, and for COD orders this is also the moment `paymentStatus` flips to `paid` (cash is collected at the door, not earlier). Every transition fires a customer-notification event through the same logged-stub `notifyStub` (§22 — no Resend/Unifonic keys exist), gated by `notifyCustomer`.

Order numbers (`LF-YYMMDD-NNNN`, §8.6) come from an atomic `findOneAndUpdate($inc)` on a per-date `counters` row — race-safe under concurrent placements, not a count-then-format query. The `Order` Mongoose schema mirrors `@lulwah/contracts`' `Order` field-for-field, plus four internal-only fields never on the wire DTO (same pattern §4.4's `soldCount`/`deletedAt` already set): `invoiceNumber`, `checkoutSessionId`, `idempotencyKey` (unique-indexed — see §4.6.3), `internalNotes` (`POST /admin/orders/:id/notes`, distinct from the customer-facing `statusHistory[].note` trail).

Endpoints (§9.7): `GET/PATCH /admin/orders*`, `POST /admin/orders/:id/notes`, `GET /me/orders*`, and guest `GET /orders/track` (no login — order number + email/phone on file stand in for auth; rate-limited via the existing `shared/rate-limit.ts` infrastructure, reusing the exact pattern `/auth/*` already uses, at 10/min/IP). Tracking returns a deliberately reduced view (`toPublicTrackingView`) — no financial breakdown, no payment details, no internal status-change notes or actor ids, only status/history/shipment/ETA.

#### 4.6.2 Checkout — session, address, shipping, payment intent, place

A `checkout_sessions` collection, not in `@lulwah/contracts` (no wire contract exists for it yet, and this build doesn't touch `apps/web`/`apps/admin`, the only consumers that would need one) — same "module-local response DTO" precedent `cart.dto.ts#CartResponse` already sets.

`POST /checkout/session` snapshots the cart (title/brand/image/SKU/article-code/options, read once from `catalog` — never populated again for display, per §7.11's snapshot rule stated twice in the plan) and extends the reservation from `CART_RESERVATION_TTL_MS` to `CHECKOUT_RESERVATION_TTL_MS`. Every subsequent step (`address`, `shipping`, `payment-intent`) re-runs the discount engine against the session's current state (`computeSessionPricing`, mirroring `cart.service.ts#recalculate`'s own pattern) — deliberately re-deriving line-level discount allocation via `pricing.service.ts#computeCartDiscounts` each time rather than copying `cart`'s aggregate `totals.discountFils`, because `cart`'s own `CartResponse` DTO never carries per-line discount amounts on the wire, and `Order.items[].lineDiscountFils` needs exactly that. Shipping is a flat AED 20 per emirate, waived above `FREE_SHIPPING_THRESHOLD_FILS` (`shipping-rates.ts` — plan.md §21's explicit "not carrier-integrated" scope, a small hardcoded table, not a `shipping_zones` admin CRUD). `place` re-validates stock and price one final time against live `catalog`/`inventory` state (`CHECKOUT_PRICE_CHANGED`/`OUT_OF_STOCK` if either drifted since the session locked them), applies discounts one final time, and only then calls `order.service.ts#createOrderFromCheckout`.

#### 4.6.3 Idempotency on `place` — the one place it actually matters

`POST /checkout/session/:id/place` requires an `Idempotency-Key` header (§9.5, enforced — missing it is `400` before any side effect runs). Two layers, deliberately: a short-TTL Redis record (`IdempotencyStore` — `RedisIdempotencyStore`/`InMemoryIdempotencyStore`, same DI pattern as `ReservationStore`/`RateLimitStore`) is the fast-path "have we seen this key" check the brief asks for; `Order.idempotencyKey`'s unique Mongo index is the correctness backstop behind it — a duplicate-key error on insert is caught and resolved by looking the existing order up by key, so even a Redis data loss or a race inside the `SET NX` window can never produce two orders for one key. Verified live and in tests: a retried `place` with the same key returns the *same* order (`200`, not `201`), never a second one; stock is decremented exactly once.

#### 4.6.4 Payment — `PaymentGateway`, COD real, Ziina unverified (P3: replaced Stripe)

`payment-gateway.ts` defines the interface exactly as plan.md §20 names it: `createIntent`, `capture`, `refund`, `verifyWebhook`.

**P3 client decision: Stripe → Ziina.** The client directed a mid-build switch to Ziina (a UAE-native payment app, dominant with UAE SMBs/consumers) as the primary card gateway — see `plan.md` v1.3's changelog and §20, §31‑Q15. The full REST contract was fetched directly from `docs.ziina.com` and recorded in `docs/ziina-integration-notes.md` before any gateway code was written. This is a structural change, not a drop-in: Ziina has **no client-side SDK** — it's a hosted-redirect flow (create a payment intent server-side → get back a `redirectUrl` → send the browser there → Ziina redirects back to success/cancel/failure → its webhook is the source of truth), unlike Stripe's client-side Elements/PaymentIntent-confirm model. `CreateIntentResult.clientSecret` (a Stripe-only concept) was renamed to `redirectUrl` — checked every caller first (only `checkout.service.ts` and the gateway's own tests referenced it, no shared contract or `apps/web` code touched it, so this was a clean rename). Ziina also has no separate authorize/capture step (a payment intent moves `pending → completed` directly, funds move at that point) — `ZiinaGateway.capture()` is an honest status-passthrough (`GET /payment_intent/{id}`, report current status), documented as such rather than faked; nothing in this codebase calls `.capture()` today, confirmed before leaving it in place.

- **`CodGateway`** — fully real, no external API: a 6-digit CSPRNG code (`node:crypto`'s `randomInt`, not `Math.random()`), sha256-hashed at rest (never the raw code), 10-minute TTL, 3-attempt cap, sent via the same logged `notifyStub` used for order notifications. `COD_FEE_FILS`/`COD_MAX_ORDER_FILS` are enforced at `payment-intent` creation (now DB-backed via `settings` — see §4.7.5). This is the payment path live-verified end to end (§4.6.5). Untouched by the Ziina swap.
- **`ZiinaGateway`** — implemented against plain `fetch` (Node 24, native) and `node:crypto` for HMAC-SHA256 webhook signature verification (Ziina has no official Node SDK — it's a plain REST API). Uses `crypto.timingSafeEqual` for the signature comparison, not `===` — a plain string comparison is a timing side-channel on money-handling code. Reads `env.ZIINA_API_KEY`/`ZIINA_WEBHOOK_SECRET` (renamed from `STRIPE_*`, same "optional, clean 503 not a crash if unset" posture). **Not live-verified against Ziina's actual API** — there is no self-serve sandbox (onboarding requires Emirates ID, done manually via the Ziina business dashboard), so no real (even test-mode) key exists for this project, exactly the same posture the old `StripeGateway` held. Code-complete and unit-tested against a mocked `fetch` (`ziina.gateway.test.ts`, replacing the deleted `stripe.gateway.test.ts`). The `stripe` npm dependency was removed from `apps/api/package.json` — nothing else needs it.
- **Webhook** `POST /webhooks/ziina` (§9.6, renamed from `/webhooks/stripe`): signature-verified via `X-Hmac-Signature`, then deduplicated via the same pre-existing `webhook_events` Mongo collection/pattern (unique index on `{provider, eventId}`) — reused as-is, not rebuilt. Ziina ships exactly one event type (`payment_intent.status.updated`); since Ziina has no Stripe-style `evt_...` event id, the dedupe key is constructed from `data.id:data.status` (stable across a retried identical delivery, distinct per real transition) — a documented judgment call. `app.ts`'s raw-body carve-out (Stripe's signature also needed exact raw bytes, not a re-serialization of parsed JSON) was repointed at the new path — still the one route in the whole API that bypasses the global `express.json()`. Never live-tested, same reason as before: no way to receive a real Ziina webhook without a live account.
- **Refunds — new in P3** (`plan.md` §8.8): `payment.service.ts#refundOrder` calls `ZiinaGateway.refund()`; `order.service.ts#refundOrder` (`POST /admin/orders/:id/refund`, `refunds.write`) resolves "amount omitted = full refund" (the one layer with `paidFils`/`refundedFils` to compute it from) and records every attempt — including gateway failures — in a new `Order.refunds[]` array on the shared contract, mirroring `statusHistory`'s immutable append-only pattern. `balanceDueFils` is deliberately left untouched by a refund (a first attempt recomputed it and double-counted — a refund is symmetric, it reduces both what's owed and what's paid by the same amount, so it cancels out of "owed minus paid" entirely; see the code comment on `refundOrder` for the full derivation). Live-verified: a full refund, a partial refund, and the two rejection paths (no captured payment; actor missing `refunds.write`) all confirmed against the real Docker stack.

**A real cross-app bug found and fixed at the source, unrelated to the Ziina swap itself**: `apps/admin`'s `Order` refund/notes UI, and `apps/api`'s own admin order endpoints, needed `AdminOrder` — see §8.14.

#### 4.6.5 Live-verified vs. test-only — precise, by sub-flow

Against this repo's actual Docker dev stack (real MongoDB replica set on 27018, real Redis on 6380) with the seeded catalog, via direct HTTP (not the test harness):

- **Guest COD checkout, fully live, start to finish**: created a cart, added a real seeded variant, restocked it via the real admin adjust endpoint, created a checkout session (confirmed the product/brand snapshot was captured correctly, including an empty `imageSnapshot` for a variant with no media — see §4.6.6's bug #2), set an inline guest address, got the free-shipping flat-rate quote (subtotal cleared the threshold), created a COD payment intent, read the real OTP out of the server's own log (the notify stub's only "delivery" channel in this environment), verified it, and placed the order with a real `Idempotency-Key` header.
- **Order auto-confirmation, live-confirmed**: the placed order came back `status: "confirmed"` immediately with a two-entry `statusHistory` (`null→pending_payment`, then `pending_payment→confirmed` with the auto-confirm note) — no manual admin action needed for COD, as designed.
- **Stock actually decremented, not just reservation-released — the priority the brief called out explicitly**: queried `GET /admin/inventory/:variantId/movements` directly after placement and got back a real `type: "sale", quantity: -2, before: 20, after: 18` row — `onHand` itself moved, confirmed independently of the reservation that preceded it.
- **Idempotency, live-confirmed**: replayed the identical `place` request with the same `Idempotency-Key` and got `200` (not `201`) back with the exact same order id.
- **Guest tracking, live-confirmed**: `GET /orders/track` with the real order number + guest email returned the reduced public view; the response has no `grandTotalFils`/`payment` fields, confirming the redaction is real, not just described in a comment.
- **Admin status transitions, live-confirmed**: `PATCH /admin/orders/:id/status` moved `confirmed → processing` (valid, `200`); a subsequent attempt at an out-of-table transition as `super_admin` without a `note` correctly came back `400` (reason required), matching the mandatory-reason rule exactly.
- **Card/Ziina: only the *absence* path is live-verified.** Confirmed `payment-intent {method:"card"}` cleanly `503`s in this unconfigured environment (same as Stripe before it). Everything else about `ZiinaGateway` — actually creating a payment intent, refunding, receiving a real webhook — is **unit-tested against a mocked `fetch` only**, never exercised against Ziina's real API. Restated because it's the one claim in this section worth being unable to overstate: this code has not talked to Ziina. (Refunds *themselves* are live-verified end to end against the `CodGateway` path — a COD order's refund genuinely calls `payment.service.ts#refundOrder`, which dispatches to whichever gateway the order's `payment.method` names; it's specifically the card/Ziina gateway's own HTTP calls that remain mock-only.)
- **Everything else** (checkout address/shipping steps individually, COD limit/OTP-required/price-changed rejections, cancellation-triggered restock + discount-usage reversal, admin notes) is covered by the 11-case `checkout.integration.test.ts` suite (`mongodb-memory-server`, not the live Docker stack) rather than re-driven by hand over HTTP — the live pass above exists to prove the real infrastructure (real Mongo replica set, real Redis, a real running process) behaves the same way the in-memory test harness says it should, not to duplicate every test case manually.

Not run live: the BullMQ worker process (`worker.ts`) — none of `order`/`checkout`/`payment`'s side effects depend on it (see §4.6.1's doc comment on why the event bus is awaited synchronously instead), so this is a scope note, not a gap.

#### 4.6.6 Narrow extensions to other modules' own files, and one real bug found

Per plan.md §5.3, `checkout`/`order`/`payment` call into `cart`/`pricing`/`catalog`/`inventory`/`identity` only through each module's exported service functions — never their Mongoose models. Building the required call sites meant a handful of small, real additions to those modules' own files (never their models directly), the same category as the previous phase's `inventory.service.ts#reserveStock`/`releaseStock` addition for `cart`'s sake:

- `cart.service.ts`: `extendReservationForCheckout` (validates stock, re-marks every line's reservation under the longer checkout TTL) and `convertCart` (sets `Cart.status = 'converted'` — a value the contract already declared but nothing set before now).
- `inventory.service.ts`: `commitReservedSale`/`restockCancelledSale` — the reservation→sale conversion plan.md §8.4 always described but deferred ("not built in this phase") until `order` existed to call it; `StockMovementType`'s `'sale'` enum value was already reserved for exactly this.
- `catalog`: `product.service.ts#incrementSoldCount` (a plain `$inc` on the already-internal `soldCount` field) and `brand.service.ts#getBrandsByIds` (the repository call already existed, just had no service-level export).
- `pricing.service.ts`: `incrementDiscountUsage`/`decrementDiscountUsage`, wrapping the repository's existing (but previously uncalled) `incrementUsedCount` plus a new, symmetric `decrementUsedCount`.
- `identity/address.service.ts`: `getAddressSnapshot` — a read-only, `userId`-scoped conversion of a saved `Address` into the immutable `AddressSnapshot` shape an order/checkout session embeds.

**A real bug found and fixed**: `checkout_sessions.items[].imageSnapshot` and `orders.items[].imageSnapshot` were both initially schema-`required`, on the assumption every product would have at least one media item by checkout time. The first live checkout attempt against a freshly-restocked seeded variant with no uploaded media (admin's Media tab only supports paste-a-URL, per §6.3 — nothing had been pasted for this particular seed row) threw `ValidationError: Path 'imageSnapshot' is required` at session-creation time, a real product legitimately having no photography yet should never block a customer from checking out. Fixed by making the field default to `''` instead of required, in both schemas.

### 4.7 The five new P3 modules — `audit`, `customer`, `content`, `report`, `settings`

Built as six parallel worktree-isolated agents (five new modules + the payment/Ziina swap), merged sequentially with independent re-verification after each merge, same discipline as P1/P2. Every new module reuses the identity module's existing RBAC (`requireAuth()`/`requirePermission()`/`assertPermission()`, plan.md §10.2's permission strings — most were already declared in P0's `identity.policy.ts` in anticipation of exactly this, `audit.read` was the one genuinely new permission added).

#### 4.7.1 Audit log (`plan.md` §11.1: "every mutating admin action... before→after diff viewer")

A generic Express middleware (`audit-log.middleware.ts`), mounted **once** ahead of every `/admin/*` router in `app.ts`, rather than instrumented into each of the other twelve modules' controllers individually — a deliberate, documented tradeoff: it captures **request payload vs. response payload**, not a database-precise before/after snapshot (that would have meant retrofitting every existing admin-mutating module's service layer). Persists fire-and-forget — an audit-write failure never fails the underlying admin action. `apps/admin`'s diff viewer labels its two panes "Request"/"Response," never "Before"/"After," so the UI doesn't overstate what it's showing. `audit.read` (new permission) is granted to `super_admin` and `manager` only.

#### 4.7.2 Customers (`plan.md` §11.1)

Composes real data across module boundaries via exported service functions only — `identity` (profile/addresses/tags/notes, extended with the minimal new exports this needed), `order` (history/spend, `sort=spend` genuinely server-side), `cart` (current cart contents). **Explicitly not built**: wishlist, reviews, measurement profiles — nothing in this codebase builds any of these anywhere, confirmed before writing the module, not assumed. The "COD risk" panel is presented as what it actually is — a `risky_cod` tag plus real COD order/cancellation counts — not a fraud-scoring model, since no such model exists.

#### 4.7.3 Content — homepage builder, banners, menus, pages, media library (`plan.md` §11.1, §7.13, §15.2)

New models for `HomeSection` (9 typed settings schemas — hero/collection_rail/editorial_split/brand_strip/category_grid/video_banner/usp_bar/journal_teaser/newsletter, validated via a Zod discriminated union), `Banner`, `Menu` (recursive nested subdocuments), `Page` (EN/AR rich text, sanitized with `isomorphic-dompurify` — the first rich-text field in this codebase, so this established the sanitization precedent rather than following one). **Collections were extended, not duplicated**: `type: 'automated'` + `rules[]` (a new `collection.rules.ts` reuses `product.repository.ts`'s existing facet-filter machinery, not a second query builder), `heroImageMobile`, `isTeaserVisible` were added to the *existing* `catalog` module's `Collection` from P1, after confirming that's where manual ordering/hero-media/layout-template already lived. Public read endpoints (`GET /content/home`, `/content/pages/:slug`, `/content/banners`, `/content/menus/:key`) exist for a future storefront-consumption stage (`apps/web` was not touched). Media library is honestly a metadata layer (folders/tags/search/alt-text) over paste-a-URL assets — confirmed no upload/S3 pipeline exists anywhere in this repo before building it, same honest scope call P1's product-media tab already made.

#### 4.7.4 Reports (`plan.md` §11.1)

Five of seven categories built for real against real data (Sales, Products, Customers, Discounts, Inventory), plus **Search** — which required adding a small, real query-logging hook to `catalog/search.service.ts` (a new `search_queries` collection) since none existed, rather than reporting on data that didn't exist. **Traffic (GA4) was not built** — no GA4/analytics integration exists anywhere in this repo (plan.md §23 is a spec, never shipped code); the admin screen shows it as "not available," not a fake chart. Reports read directly across module collections via Mongo aggregation in a few places (documented, commented exceptions to the module-boundary rule, justified as read-only cross-cutting analytics) rather than composing many small service calls. CSV export only — no XLSX dependency was added; a hand-rolled ~35-line RFC 4180 writer was used since no CSV library existed anywhere in the repo yet.

A real bug caught while building this: `catalog.getVariantsByIds` (used by `cart`) deliberately nulls `costPriceFils` before returning it — reusing it for the Discounts/Inventory reports would have silently reported margin/stock-value as zero everywhere. A separate admin-only `getVariantsWithCostByIds` was added instead of reusing the cost-blind one.

#### 4.7.5 Settings (`plan.md` §11.1, §31‑Q5)

Made three previously-hardcoded values genuinely DB-backed, without touching their default behavior: `checkout/shipping-rates.ts`'s per-emirate rate table + free-shipping threshold, COD fee/cap, and the VAT tax rate — all now read live from a new `settings` singleton document via `checkout.service.ts`/`cart.service.ts`/`order.service.ts`, seeded on first read to exactly match the old hardcoded values so nothing already-tested regressed (confirmed: all pre-existing checkout/payment/pricing/cart/order tests pass unchanged). **Payment gateway keys are never stored in the database** — the Settings screen shows only a masked, computed-fresh-from-`env.ts` status (`{ provider: 'ziina', apiKeyConfigured, webhookSecretConfigured }`), per plan.md §19's "secrets never in git/DB" rule; no endpoint anywhere accepts a raw key. Email/SMS template management and legal-page storage were explicitly not built — `notify.ts` is a deliberate stub (§4.1) and legal pages are `content`'s `Page` type's job, not duplicated here.

---

## 5. Storefront — `apps/web` (plan.md §12–§16)

Next.js 16.3 App Router. Route tree matches `plan.md` §12.1 closely (see the file list in §1 above for exact pages). **PLP, PDP, Home's product rails, Brands, and Search now call the real catalog API** (`apps/web/lib/catalog-client.ts` + `api-client.ts`) — this is the main change since P0. Cart/checkout/account remain local-state-only (no backend for them yet).

### 5.1 What's genuinely built out

- **Home** (`app/[locale]/page.tsx`): **now genuinely CMS-driven**, closing §11's old item 4. Real `GET /content/home` (`content` module, §4.7.3) sections render through the matching existing component — `hero`→`Hero`, `collection_rail`→`CollectionRail` (both "New arrivals" and "Best sellers" are this one type; a null `collectionId` falls back to a live `sort=newest`/`sort=bestselling` `listProducts()` call, `viewAllHref`-inferred per `lib/content-mappers.ts#inferCollectionRailSort`'s documented rule — the settings shape has no field naming which), `editorial_split`→`EditorialSplit`, `brand_strip`→`BrandStrip` (ids resolved to real `Brand` entities), `category_grid`→`ShopByStitching` (1–3 tiles) or `OccasionTiles` (4+ tiles) by count, `video_banner`→`FullBleedBreak`, `usp_bar`→`UspBar`, `newsletter`→`NewsletterSection`. `journal_teaser` sections are skipped outright (still R2-scoped, §15.2 item 10). Every one of those components now takes an optional CMS-`settings`+`locale` prop pair and falls back to its original static translation/image when omitted. **Explicit, documented fallback**: zero (or entirely unusable) CMS sections renders the original fixed §15.2 launch order unchanged — real, expected, since no content editor had populated a homepage as of this writing (confirmed live: `GET /content/home` returned `{sections: []}` against the real dev database). New files: `lib/content-client.ts`, `lib/content-schemas.ts`, `lib/content-mappers.ts`, `components/sections/ContentLink.tsx`. A real, separate bug was found and fixed at the source while live-testing the `collection_rail`→specific-collection path — see §8.19.
- **PLP** (`shop/[...category]`): filter rail in the exact §15.3 facet order, wired to real facet data and counts, 2-up/3-up grid, "Load more" pagination via `nuqs`. Handles the parent/leaf category mismatch — see §4.4's note. Multi-select facet checkboxes exist in the UI but only the first selected value per facet is actually sent to the API (`ListProductsQuery` doesn't accept multi-value params) — a known, documented gap, not a bug.
- **PDP** (`product/[slug]`): info-column order per §15.4, now rendering real per-variant availability ("In stock" / "Only N left" / "Sold out") from the API's live `VariantWithAvailability[]` instead of a static number. Colour options render as bordered name buttons rather than hex swatches — only a product's primary colourway has a real hex in the schema, a variant-level colour is just a string. 404s render a real not-found page for a bad slug.
- **Brands** (`brands`, `brands/[slug]`) and **Search** (`search`): both wired to the real API; search's zero-result state suggests the three real nearest collections (not fabricated ones), per §15.3's requirement.
- **`ProductCard`** and **`PriceBlock`**: built to the exact §13.6/§8.2 spec (3:4 media, diagonal clip-path hover wipe, tabular price with garnet `-N%` badge shown only when `discountPercent >= 5`) — unit-tested (10 tests covering the rounding/threshold rules specifically). Untouched by the API-wiring work; a thin mapper layer (`lib/product-mappers.ts`) adapts real API responses onto these components' existing prop shapes instead.
- **Header**: real nav, real logo (see §7), scroll-hide behavior. **Not** transparent-over-hero (see §8.4 — this was attempted, found broken, and deliberately simplified to always-solid rather than fixed properly).
- en/ar routing via `next-intl`, RTL logical properties, self-hosted fonts (Bodoni Moda / Archivo / Aref Ruqaa / IBM Plex Sans Arabic) via real Fontsource-sourced files, not placeholders.
- **`app/[locale]/error.tsx` and `not-found.tsx`**: added alongside the real API wiring — a real fetch can fail or 404 now, where placeholder data never did.

### 5.2 Explicitly not built (stated in the original brief, still true)

Mega-menu (four-column crossfading panel), mobile filter bottom-sheet, full brand-history CMS content, GSAP/Lenis/WebGL motion (all R2 per §3.1), full Arabic translation (representative message keys only), a working "Size guide" drawer (no per-brand measurement-chart content source exists yet), real card payment (see §5.4 — no live Ziina account exists for this project). Cart/checkout API wiring is **done** — see §5.4, this is no longer a gap.

### 5.3 Custom `next/image` loader gotcha

`lib/image-loader.ts` implements the §4.1 imgproxy-loader pattern, but **no imgproxy container exists in local dev** (`docker-compose.dev.yml` intentionally only runs mongo/redis/meilisearch, per §25.1). The loader now falls back to serving local assets directly when `NEXT_PUBLIC_IMGPROXY_URL` is unset (see §8.3) — this is what makes local image preview possible at all right now.

### 5.4 Cart & checkout — real API client (plan.md §7.10, §9.5, §15.6)

`stores/cart-store.ts` (local-only Zustand) is gone, replaced by TanStack Query over the real `cart`/`checkout`/`order`/`payment` API (`lib/cart-client.ts`, `checkout-client.ts`, `order-client.ts` + matching `*-schemas.ts`, `hooks/use-cart.ts`). The `lulwah_cart` cookie the API sets on `POST /cart` **is** the cart id — no separate client-side id state.

- **Cart**: `AddToBagForm` and the cart page call the real add/update/remove/coupon endpoints; quantity/removal are genuinely optimistic-with-rollback, add/coupon reconcile from the server response (server-computed totals, never recomputed client-side, per §8.5).
- **Checkout**: the real 3-step flow — session created on leaving Contact (guest email required, per plan.md §15.6 "no forced account creation"), address + shipping on leaving Delivery (real flat-rate quote rendered, not recomputed), payment-intent/COD-OTP/`place` on Payment. `place` sends a real `Idempotency-Key`, generated once per page load and reused on retry.
- **Card payment now drives Ziina's real hosted-redirect flow** — the storefront's one remaining P3 loose end (§11's old item 1), now closed. `payment-intent {method:"card"}` still cleanly `503`s in this environment (no live Ziina account exists — see §4.6.4); what changed is everything behind that gate. Submitting Payment for `card` calls `place()` **first** (the real `Order` is created, `pending_payment`, `payment.intentId` already set — the exact sequencing `order.service.ts#recordCardPaymentResult`'s webhook handler already assumed but nothing actually produced) and only on that success does `checkout/page.tsx` send the browser to `redirectUrl` — never before an order exists to receive Ziina's eventual webhook. A new route, `checkout/session/[sessionId]/return/page.tsx`, is where Ziina's `success_url`/`cancel_url`/`failure_url` land — built server-side by `checkout.service.ts#buildCheckoutReturnUrls`, keyed by checkout session id (no order number exists yet at payment-intent-creation time, which is *before* `place()` runs). `result=success` does a real server redirect to the existing confirmation page (never fabricates a "confirmed" message off the redirect alone — the order's actual status, still `pending_payment` until the webhook fires, is what renders); `result=cancel`/`failure` render an honest "order not completed, your bag has already been cleared" message with no retry-payment attempt — `place()` unconditionally converts the cart the instant the order is created, before the browser is ever sent to Ziina, so a genuine retry would need a new create-intent-for-an-existing-order code path that doesn't exist anywhere in this codebase.
- **`orderNumber` added to `CheckoutSessionResponse`** (`checkout.dto.ts` + `checkout.mapper.ts`, mirrored in the storefront's `checkout-schemas.ts`), set by `checkout.repository.ts#markCompleted` at the same moment as `orderId` — this is what lets the return page resolve "what order came from this session" via the already-public `GET /checkout/session/:id`, no new endpoint needed. That endpoint itself needed a real fix to make this work: it previously only ever queried for `status: 'open'` sessions, so it `409`'d on any session `place()` had already marked `completed` — exactly the state the return page hits every time. `checkout.service.ts#requireSessionForRead` (used only by the read path; every mutating step — `setAddress`/`setShipping`/`createPaymentIntent`/`place`/`verifyCodOtp` — keeps requiring `open` via the original `requireOpenSession`) fixes this.
- **A second real bug found and fixed, live**: the return page's `result=success` redirect to the confirmation page was first built with the bare `next/navigation#redirect`, which drops the `/en`/`/ar` locale prefix — `next-intl`'s middleware (`localePrefix: 'always'`) still gets the customer there in the end, but only via a second, avoidable 307 hop, confirmed live via `curl -D -` before the fix. Fixed with `@/i18n/navigation#redirect`, passing this page's own `locale` route param explicitly rather than relying on inference.
- **Order confirmation** (`checkout/confirmation/[order]/page.tsx`, new) and **guest order tracking** (`account/orders/page.tsx`, now real — there is no login UI anywhere in the storefront, so this uses `GET /orders/track`, not the auth-gated `/me/orders`) both render real order data.
- **`CartItem` has no title/brand/image** in the API contract (by design — it only snapshots enough for pricing) — `lib/cart-display-cache.ts` is a small local-only cache of display data keyed by variant id, cosmetic only, never consulted for price/quantity/totals.
- **A real UX bug found and fixed**: the pre-checked "Cash on Delivery" radio never fired a change event, so the OTP flow never auto-started on entering the payment step — now triggered explicitly.
- **A real cross-app contract bug found and fixed at the source** (not just worked around): see §8.12.
- **A third real bug, found and fixed immediately before this Ziina-redirect workstream started**: `checkout-schemas.ts#PaymentIntentResponse` still had Stripe's `clientSecret: z.string().nullable()` field name from before the API's Stripe→Ziina swap. Since the field is required-but-nullable (not optional), a response missing it entirely failed Zod parsing outright, breaking `createPaymentIntent()` for **both** card and COD (they share the same endpoint/schema) — meaning this section's own already-"live-verified" COD checkout path was actually broken at runtime the whole time, because every prior verification pass had gone through direct `apps/api` calls, never `apps/web` itself. Renamed to `redirectUrl` to match the real API shape (commit `d826ed7`) — this is what made it possible to finally drive a checkout through the real storefront pages, not just curl the API, for the live pass below.

Live-verified against the real Docker stack, start to finish, **for the first time through the real running `apps/web` `next dev` server** (requests against `localhost:3000`'s actual rendered pages, not just direct `apps/api` calls — the exact gap the `clientSecret` bug above had been silently hiding): created a cart and added a real seeded variant, created a checkout session, set an address, got the flat-rate shipping quote, created a COD payment intent, read the OTP out of the API server's own log, verified it, and placed the order with a real `Idempotency-Key` — replayed and confirmed idempotent (same order, no duplicate; stock genuinely decremented, confirmed against the seeded variant). `GET /checkout/session/:id` after `place()` came back `status: 'completed'` with the real `orderNumber` populated (the `requireSessionForRead` fix above). The new return route (`checkout/session/[sessionId]/return`) was hit directly through the real Next dev server for all three Ziina outcomes: `result=success` produced a real `307` straight to `/en/checkout/confirmation/<orderNumber>` (confirmed via `curl -D -`, which is also how the locale-redirect bug above was caught), and that confirmation page rendered `200` with the real order number visible; `result=cancel`/`result=failure` rendered the honest no-retry messaging; a nonexistent session id rendered the "couldn't find your order" fallback. The card path was verified up to its documented `503` boundary — same session setup, `payment-intent {method:"card"}` returned a clean `503 SERVICE_UNAVAILABLE`, confirming `buildCheckoutReturnUrls()` runs without error before the gateway-unconfigured check fires. Not verified: an actual mouse-driven click-through in a rendered browser (still no browser-automation tool available in this environment) — every step above is the exact HTTP request a browser's own JS would issue, replayed directly against the real Next.js SSR/redirect pipeline serving the response, not a screenshot.

---

## 6. Admin console — `apps/admin` (plan.md §11)

Next.js 16.3, client-rendered, `noindex`. **All eleven §11.1 screens now have real depth** — Orders/Products/Inventory since P2, and as of P3: Discounts, Customers, Content, Reports, Settings, Users & roles, plus a new Audit log screen §11.1 also calls for. See §6.5–§6.11.

### 6.1 The one thing built to spec in full: order status (plan.md §8.7)

- `lib/order-status.ts` — `getValidNextStatuses()` encodes the exact §8.7.2 transition table, including both special cases (`out_for_delivery → shipped` as a rollback; `cancelled → refunded`).
- **32 passing unit tests**, one per state/transition combination in §8.7.1/§8.7.2 — this is the most thoroughly tested piece of the whole build.
- `StatusTransitionDropdown` renders *only* what that function returns — invalid transitions are never in the DOM, matching §8.7.4's explicit requirement literally.
- Wired into a real Orders table + detail page with placeholder orders spanning every status, a shipped-requires-tracking mini-form, and an optimistic-update mutation pattern.

### 6.2 Everything else (pre-P3 state — see §6.5–§6.11 for what replaced this)

~~Discounts, Customers, Content, Reports, Settings, Users: page shells exist (sidebar nav, page headers, a reusable `DataTable`), minimal-to-no real content.~~ **All six now have real depth as of P3.** The login page's TOTP field doesn't verify against anything real (no 2FA backend exists) — but login itself is now real, see §6.3.

### 6.3 Products & Inventory — real CRUD against the real catalog API (plan.md §11.1)

- **Products list** (`app/(dashboard)/products/page.tsx`): real `DataTable` against `GET /admin/products` — thumb, brand (joined from `GET /admin/brands`), article code, stitching type, price, stock, status.
- **Product editor** (`products/new`, `products/[id]`), one shared component with all 7 §11.1 tabs: Basics, Attributes (the Pakistani-fashion fields — piece-count builder, per-piece editor, fabric/work/occasion/season/colour), Media (paste-a-URL, since no upload/S3 pipeline exists — confirmed, not silently under-built), Variants (size×colour matrix generator), Pricing, Inventory (mandatory-reason stock adjust), Publishing. Media/Variants/Inventory tabs are disabled until a product is saved once, since those endpoints nest under `/admin/products/:id/...`.
- **Inventory** (`app/(dashboard)/inventory/`, list + `[variantId]` detail): real low/out-of-stock/search filters, mandatory-reason adjustment with client-side validation mirroring the API's Zod rules, per-variant movement history.
- **A real bug found and fixed here**: `lib/api-client.ts` sent `credentials: 'include'` but never attached `Authorization: Bearer <token>` — every RBAC-gated admin call would 401 regardless of how correct the rest of the admin UI was. Fixed alongside a login-page/schema correction (the old version expected a placeholder response shape and a `totpCode` field the real `/auth/login` endpoint doesn't accept).
- **What's read-only or absent, deliberately**: `lowStockThreshold`/`allowBackorder` show read-only in the Inventory tab (no update endpoint exists — those are set only at `InventoryItem` creation); no media delete/reorder (API only has `POST`, no `PATCH`/`DELETE`); no product-delete UI (soft-delete via `status: archived` is the intended path); no pricing/discount UI beyond the two real fields (no discount engine exists).
- 13 new unit tests (`lib/product-editor.test.ts`, the variant-matrix/piece-builder pure logic) alongside the pre-existing 32 — 45 total in this app now.

### 6.4 Orders — real data under the already-correct state-machine UI (plan.md §8.7, §9.7, §11.1)

§6.1's `getValidNextStatuses`/`StatusTransitionDropdown`/`StatusFlagPill` were **not touched** — they were already correct, tested against the exact table the API now also implements (§4.6.1). Only the data source changed: `lib/queries/orders.ts` (new) replaces `lib/queries.ts`'s placeholder `fetchOrders`/`fetchOrderById`/status-mutation functions with real calls to `GET/PATCH /admin/orders*` and `POST /admin/orders/:id/notes`, same TanStack Query optimistic-update-with-rollback pattern the app already used for Products/Inventory.

- **Orders list** (`app/(dashboard)/orders/page.tsx`): server-side `status`/`paymentStatus`/`search` filters (confirmed these are the only three real query params `AdminListOrdersQuery` supports — `dateFrom`/`dateTo`/`emirate`/`sort` aren't, so sort stays client-side over the fetched page, not faked as a server capability).
- **Order detail** (`orders/[id]/page.tsx`): real items/money-breakdown/address/status-history; the status mutation now sends `trackingNumber`/`carrier` as their own fields on entering `shipped`.
- **A real bug found and fixed here**: the old placeholder version smuggled `trackingNumber`/`carrier` into the status-change *note* as a concatenated string instead of sending them as the real fields the API expects — fixed, confirmed live that a genuine `shipments[]` entry is created now, not a note.
- ~~**A real, narrower gap surfaced (not fixed, documented instead)**: `order.mapper.ts` never puts `internalNotes` on the wire...~~ **Fixed in P3** — see §8.14. `orders.ts` now types every admin order response as `AdminOrder` (not `Order`) and internal notes display for real, round-tripping across a page refresh and between staff members. The old session-local note-list workaround was removed.
- Dashboard's "orders needing action" and "low stock" tiles now read real data too; the four top summary stat tiles stay placeholder (no reports/analytics API module exists).
- Super_admin's force-any-transition escape hatch (mandatory reason) is left API-only for now, per that workstream's own scope call.

Live-verified against the real Docker stack: logged in as the seeded `super_admin`, exercised server-side filters, detail fetch, a real `stitching → ready_to_ship → shipped` transition carrying real tracking data, and a note POST. No browser-automation tool was available, so this was request/response-level verification plus confirming the page shells serve 200 with no server errors — not an interactive click-through.

### 6.5 Orders — P3 additions: refund action, real notes, CSV export (`plan.md` §11.1, §11.2 rule 3)

Three additions on top of §6.4's already-real Orders screen: (1) the `AdminOrder`/notes fix above; (2) a **refund action** — a panel defaulting the amount to the real refundable balance (`order.paidFils - order.refundedFils`, mirroring the API's own formula), typed confirmation requiring the admin to type the order's own order number (plan.md §11.2 rule 3 names refund as its own example of "needs typed confirmation"), following the exact optimistic-with-rollback mutation shape the status-update mutation already established; refund history (`order.refunds[]`) renders as a simple list including failed attempts; (3) **CSV export** of the currently filtered/sorted order list — the lowest-effort, highest-value piece of §11.1's "bulk: status change, print packing slips, export CSV, tag" row; bulk status-change/packing-slips/tagging were not attempted, documented as a gap rather than rushed.

### 6.6 Discounts — builder, bulk codes, live preview (`plan.md` §11.1)

Full CRUD against `pricing`'s existing API: list with server-side status/mode/search filters, a 6-tab builder (mode/type/value/targets/conditions/schedule/limits/stacking/priority/badge EN-AR) matching `packages/contracts/src/discount.ts` field-for-field. **Two things the backend doesn't have, handled honestly**: bulk code generation is real — N individual `POST /admin/discounts` calls (chunked), not a fake bulk endpoint, since none exists; live preview ("on a sample cart of X, this gives AED Y off") has no server endpoint either, so a client-side approximation was built that only computes real numbers for the simple cases (flat percent/fixed, untargeted, no minimum quantity) and explicitly declines rather than guesses for tiered/BOGO/bundle/stacked cases. "Revenue attributed" (in `plan.md`'s list-column spec) was omitted entirely — confirmed no such field/computation exists anywhere in the `pricing` module.

**A real, separate bug found and fixed during this screen's live verification**: three discounts were created with the identical code `INFLU0002` with no rejection — traced to §8.15's cross-cutting index gap, not a bug in this screen's own code.

### 6.7 Customers (`plan.md` §11.1)

List (search/tag/marketingConsent/sort, all genuinely server-side) plus a new detail page: profile, addresses, paginated order history, current cart, tags and internal notes as real optimistic mutations, and the COD-risk signal presented as what it actually is (§4.7.2). Wishlist/reviews/measurements: no fake sections, just absent, since nothing in the codebase builds them.

### 6.8 Content — homepage builder, banners, menus, pages, collections, media library (`plan.md` §11.1)

The largest single P3 screen. Homepage builder: native drag-reorder over the real reorder endpoint, a genuinely typed settings sub-form per each of the 9 section types (not one generic form). Banners/Menus/Pages/Media library: real CRUD against `content`'s API. Collections: extended the *existing* catalog-module admin surface (§4.7.3) with a real rule builder for automated collections and a launch/end scheduler with the `isTeaserVisible` countdown toggle — no admin UI existed for Collections at all before this task. Two honest, explicitly-labeled gaps: the homepage builder's "live preview iframe" (`plan.md`'s own wording) has nothing to point at yet, since `apps/web` has no route rendering `home_sections`; and the media library is metadata-over-paste-a-URL, not a real uploader, per §4.7.3. Also added this app's first real toast system and typed-confirmation dialog (see §8.18 — a second P3 screen built near-identical versions of both independently, since the two ran in parallel; consolidated onto this screen's versions after both merged).

Live-verified against the real Docker stack: created and deleted a real home section, page, banner, menu, media asset, and an automated collection with a rule, directly via the running API.

### 6.9 Reports (`plan.md` §11.1)

Six tabs matching §4.7.4's real backend categories, plus a visible-but-honest "Traffic — not available" tab rather than silently dropping the category `plan.md` names. CSV export via a real authenticated blob download (`apiRequestCsv()` — a plain `<a href>` can't carry the `Authorization` header this API requires, confirmed by reading `report.controller.ts`'s actual `?format=csv` response shape first). Live-verified against the real API, including a real 403 on a role lacking `reports.write`.

### 6.10 Settings & Users and roles (`plan.md` §11.1)

**Settings**: a real form against the DB-backed values §4.7.5 describes — store details/TRN, the per-emirate shipping-rate table, free-shipping threshold, COD fee/cap, tax rate, feature-flag toggles, maintenance-mode toggle, and a read-only payment-gateway status card. The UI states plainly that `maintenanceMode`/feature flags persist for real but nothing in the codebase currently reads either field yet (verified by tracing every call site) — the toggles work, they just have no live effect. **Users & roles**: a real list against `GET /admin/users` and a real role-change control (typed confirmation + a client-side guard against self-role-change) — but `identity.routes.ts` has exactly two admin routes, list and role-change, full stop. No invite/2FA-reset/deactivate/session-revoke endpoint exists anywhere in `apps/api`. Rather than silently omitting those controls or wiring them to nothing, they render as visibly disabled "coming soon" buttons with a panel stating the gap plainly — real missing functionality, not a bug or an oversight to paper over.

### 6.11 Audit log — new screen (`plan.md` §11.1, not in the original ten-screen build)

A new `/audit` route: filterable by actor/entityType/entityId/date range, column visibility, a diff viewer explicitly labeled "Request"/"Response" (never "Before"/"After," matching §4.7.1's honest scope). Gated on `audit.read` (super_admin/manager only) — a new `AccessDenied` component (this app's first permission-gated empty state; also reused by Reports for its own `reports.write`-denial case) renders instead of a raw error or blank page for anyone else. Live-verified: generated real mutating traffic, confirmed it appeared in the log with the exact shape the diff viewer expects, and confirmed all three permission-denial paths return real 403s.

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

### 8.8 `apps/web` had no `.env` at all — broke the production build, not just dev

Nothing provided `NEXT_PUBLIC_API_URL`/`API_INTERNAL_URL` locally for `apps/web` (Next.js only loads env files from the app's own directory, not the monorepo root). This wasn't just a dev inconvenience: `next build` prerenders ISR pages (e.g. `/brands`) at build time, so the production build failed outright — `TypeError: Failed to parse URL from /api/v1/brands` (empty base URL, `fetch()` can't resolve a relative path outside a browser). Separately, root `.env.example`'s `API_INTERNAL_URL=http://api:4000` is the Docker-network hostname, correct for production but unresolvable on the host in local dev — same bug class as §8.7. Added `apps/web/.env.example` (and a local `.env`) with the local-dev-correct values, documented why they differ from production's.

### 8.9 Admin never attached the auth token to API requests

`apps/admin/lib/api-client.ts` sent `credentials: 'include'` but never set `Authorization: Bearer <token>` — every RBAC-gated admin endpoint (all of Products/Inventory) would 401 regardless of how correct the calling code was, since the API's `requireAuth()` reads the bearer header, not a cookie (§10.1: the access token lives in memory/`Authorization` header, only the *refresh* token is a cookie). Found and fixed while wiring the admin product editor; the login page/schema also needed a matching fix — it expected a placeholder `{sessionId}` response shape and sent a `totpCode` field the real `/auth/login` endpoint doesn't accept.

### 8.10 Meilisearch master key mismatch between root `.env` and `apps/api/.env`

The running Meilisearch container reads its master key from the *root* `.env` (via `docker-compose.dev.yml`), but `apps/api/.env.example`'s documented value didn't match what was actually already running — `pnpm seed`'s reindex step failed with "The provided API key is invalid" even though Mongo seeding succeeded. Fixed by syncing `apps/api/.env`'s `MEILI_MASTER_KEY` to the value the container was actually started with. Worth checking `docker inspect <container> --format='{{range .Config.Env}}{{println .}}{{end}}'` against your own `.env` if this recurs — the container keeps whatever key it was *first* started with, so a later `.env.example` edit doesn't retroactively fix an already-running container.

### 8.11 PLP category filters returned zero results for most real nav links

`GET /products?category=` exact-matches one category id (correct, matches its own DTO), but the storefront's real nav links (`/shop/unstitched`, `/shop/formal-wedding`, ...) resolve to **parent** taxonomy nodes while every seeded product is tagged only with a **leaf** category — so the naive "resolve slug → pass its id" wiring returned zero products for almost every category page. Fixed storefront-side: expand the resolved category to its full descendant-id set before filtering (`apps/web/lib/plp-data.ts`). Not an API bug — a future direct consumer of `GET /products?category=` should know it wants a leaf id, not any node in the tree.

### 8.12 `OrderShippingMethod.id` typed as an ObjectId in the shared contract, but never one in practice

`packages/contracts/src/order.ts` typed `OrderShippingMethod.id` as a strict Mongo `objectId`. Plan.md §21 ships R1 shipping as a flat per-emirate rate table (`checkout/shipping-rates.ts`), not a `shipping_zones` collection — the real value is always a stable string like `'standard'`, never an ObjectId — so **every real placed order failed strict schema validation** on any client that actually parsed the response against the shared contract (`Order.mongoose model` already correctly typed the field as plain `String`; only the Zod contract disagreed with its own database).

Found by the storefront-wiring agent, who went further than eyeballing raw JSON and ran the actual Zod schema files against live API responses — this is exactly the kind of bug that "the build compiles and the happy-path test passes" never catches, since `mongodb-memory-server` integration tests construct their own fixtures and never hit this specific real-data shape. The storefront agent worked around it with a locally-widened schema in `apps/web` (touching `packages/contracts` was out of that task's scope) — but `apps/admin`'s order queries import `@lulwah/contracts`' `Order` directly and would have hit the identical failure on any real order with this shipping method. Fixed at the source instead of leaving two apps carrying two different local patches for one shared bug: `id: objectId` → `id: z.string()`, verified every consumer (`api`/`admin`/`web`) still typechecks clean.

### 8.13 Checkout never attached a logged-in customer's identity to their own order

`checkout.routes.ts`'s own doc comment already claimed "`checkout.service.ts` reads `req.user` when present" — but no middleware ever populated `req.user` on any checkout route (`requireAuth()` would have wrongly forced login on a guest-checkout flow; nothing else set it). Consequence: `session.userId`/`order.userId` were always `null`, identical to a genuine guest, even for a customer who was logged in the entire time. Found while surveying P3 scope (not reported by any single agent — a read of `checkout.controller.ts:19`'s `return req.user ?? null` against the actual router revealed nothing upstream could ever populate it). Fixed by adding `attachUserIfPresent()` to `identity.policy.ts` — parses the Bearer token if present, never rejects the request if it's missing or invalid (proceeds as a guest either way) — and mounting it ahead of every route in `checkout.routes.ts`. Covered by a new integration test that drives a full logged-in checkout and confirms both `order.userId` and a real `GET /me/orders/:orderNumber` round trip, not just that it typechecks.

### 8.14 Admin notes were write-only — persisted for real, never readable back

`POST /admin/orders/:id/notes` always wrote a real note to `Order.internalNotes` in Mongo, but every admin order-read endpoint (`adminGetOrder`, `adminListOrders`, `updateOrderStatus`, `addAdminNote` itself, `refundOrder`) used the same `toOrderDto()` the customer-facing `/me/orders`/`/orders/track` endpoints use, which deliberately strips `internalNotes` (by design — a customer must never see staff notes about their own order). Net effect: a note could never be read back through *any* endpoint after the one response that wrote it — `apps/admin`'s Orders screen worked around this with a session-local note list (documented honestly in its own P2-era code comment, §6.4). Fixed with a new `AdminOrder` type (`Order` extended with `internalNotes`) and `toAdminOrderDto()`, used only by the five `/admin/orders*` service functions — customer-facing reads are byte-for-byte unchanged. The one existing test that had literally asserted the old (buggy) "notes never come back" behavior was updated to assert the fix, and extended to confirm a note survives a second admin `GET` and still never appears on the public tracking view.

### 8.15 Unique indexes were never actually built on any real database — the widest-blast-radius bug found this phase

`shared/mongo.ts` sets `autoIndex: false` deliberately (correct for production — never block a deploy building indexes on a large existing collection) with a doc comment promising "indexes are created by a migration step at deploy time." **That migration step never existed anywhere in the repo** — only each integration test suite's own `Model.syncIndexes()` call in its own setup, which never touches a real database. Consequence: every unique index in the system — `users.email`, `orders.orderNumber`/`idempotencyKey`, `discounts.code`, `products.slug`, all the way back to P0 — was silently unenforced on every real environment, local dev included, for the entire build.

Found live while verifying the P3 Discounts screen: three discounts were created with the identical code `INFLU0002`, no rejection. Fixed with a script that imports every model so it registers, then calls `syncIndexes()` on each of the 26 registered models; safe to re-run any time. Running it against the live dev database immediately surfaced a **second, independent real bug** it was specifically built to catch: two distinct seeded products (different brands, different article codes — Sana Safinaz vs. Elan) share the literal title "Velvet Winter Shawl," colliding on slug. Fixed by disambiguating one title in `seed-data.ts`. Notably, every module's duplicate-key error handling (`product.service.ts#createProduct`, `pricing.service.ts#createDiscount`, ...) was **already written correctly** — a clean `409 CONFLICT` via an `isDuplicateKeyError()` check — it just could never fire in practice, since the index it depends on never existed until this fix. Live-verified after the fix: a second discount with a duplicate code now correctly throws at the database layer. Full API suite re-confirmed green after: 407/407.

**This should run as part of any real deploy pipeline** — it now does, for real, not just in local dev — see §8.17.

### 8.17 The deploy-time migration step §8.15 needed didn't exist either, and the file that first tried to be it wouldn't have compiled into the production image

`plan.md` §36.9's own deploy runbook already names the exact fix for §8.15: `scripts/deploy.sh` runs `docker compose ... run --rm api node dist/scripts/migrate.js` before every rolling restart. Neither `scripts/deploy.sh`/`rollback.sh`/`smoke.sh` nor `dist/scripts/migrate.js` existed anywhere as real, checked-in files — the whole deploy pipeline was a markdown code block, not runnable infrastructure. Added all three shell scripts for real (`scripts/deploy.sh`, `rollback.sh`, `smoke.sh`, transcribed faithfully from `plan.md` §36.9's own specification — not execution-tested against a real VPS, since none exists for this project, but syntax-checked and internally consistent with the real `docker-compose.yml` service names).

The index-sync script itself (§8.15) was first added at `apps/api/scripts/sync-indexes.ts` — outside `src/`, alongside the existing dev-only `seed.ts`/`reindex.ts`. That was a real mistake, caught while wiring it into `deploy.sh`: `apps/api/tsconfig.json` (the config `pnpm build` actually runs) has `include: ["src"]`, `rootDir: "src"` — anything outside `src/` never gets compiled at all. `tsconfig.scripts.json` covers `scripts/` too, but it's `noEmit: true`, typecheck-only, precisely so `seed.ts`/`reindex.ts` (always run via `tsx` against source, never needed as compiled JS) don't need a build step. `dist/scripts/migrate.js` would therefore never have existed in a real production image — `plan.md`'s own deploy line would have failed on the very first real deploy. Fixed by moving the file to `apps/api/src/scripts/migrate.ts`: since it's now under `src/`, the existing build naturally emits it to `dist/scripts/migrate.js` with its relative imports (`../shared/mongo.js`, `../modules/*/*.model.js`) resolving correctly against the rest of the real compiled output — no new tsconfig, no second build step. Verified for real: `rm -rf dist && pnpm build` produces `dist/scripts/migrate.js`, and running it (`node dist/scripts/migrate.js`, and separately `pnpm db:sync-indexes`/`pnpm migrate`, which are now the same file under two names) against the live dev database works cleanly. Full API suite re-confirmed green: 414/414.

### 8.18 Two parallel P3 admin-frontend agents built duplicate UI primitives

The Content and Discounts admin screens (§6.8, §6.6) were built by separate parallel agents in isolated worktrees, neither aware of the other's in-flight work. Both independently discovered no toast primitive and no typed-confirmation-dialog primitive existed anywhere in `apps/admin` (both true, per plan.md §11.2 rules 2–3), and both built one: Content's `ToastHost`/`toast-store.ts` (global Zustand store, mounted once in `Providers.tsx`) vs. Discounts' `Toast.tsx` (a per-screen local hook, deliberately *not* touching `Providers.tsx` — its own doc comment explains this was to avoid colliding with other in-flight worktrees editing the same shared file, a reasonable defensive call that didn't fully prevent the duplication); Content's `TypedConfirmDialog` vs. Discounts' `ConfirmDialog` (functionally identical, different prop name for "the string the operator must retype"). Not a functional bug — both worked correctly — but real duplication. Consolidated onto Content's versions after both merged (already used across 5 files vs. Discounts' 1–2, and the global store is the more reusable shape); migrated Discounts' two call sites; deleted the now-dead `Toast.tsx`/`ConfirmDialog.tsx`. A structural note for future multi-agent phases: briefing every parallel agent with "note: N other agents are working on other screens in parallel" (which P3's Stage 2 briefs did) reduces but doesn't eliminate this class of collision when two agents independently need the same *kind* of new shared primitive rather than editing the same file.

### 8.19 `GET /products?collection=` silently returned zero products for every real manual collection — found wiring Home's `collection_rail` CMS section

Found live while wiring `app/[locale]/page.tsx`'s new `collection_rail` section to a real, admin-created collection (`docs/implemented-plan.md` §5.1/§11 item 4): a home section configured with `collectionId` pointed at the real, non-empty "Lawn '26 — Volume One" collection (6 real `productIds`) came back with **zero** products from `GET /products?collection=lawn-26-vol-1`, every time.

Root cause: `product.repository.ts#buildFilter` filtered on `Product.collectionIds` — a denormalized array field independently settable via `AdminCreateProductInput.collectionIds`, but never once written by this codebase's only real collection-curation workflow (the Content/Collections admin screen, §6.8, which edits `Collection.productIds` instead). The two arrays were never reconciled anywhere, so the filter always matched against an empty field for every real collection built through the only UI that actually exists for building one. A **second**, independent bug sat right next to it: `product.service.ts#listProducts` resolved an unrecognized `collection` slug to `undefined` and then simply omitted the filter rather than erroring or returning zero — `GET /products?collection=totally-fake-slug` silently returned the full unfiltered listing, confirmed live.

Fixed at the source in `apps/api/src/modules/catalog/`: a new `collection.service.ts#getCollectionProductIds(slug)` resolves a collection's *real* membership — a manual collection's stored `productIds`, or (reusing the exact resolution `resolveCollectionDto` already does for the public collection-detail payload) an automated collection's live rule-matched ids — and returns `[]` for an unresolvable slug. `product.service.ts#listProducts` now feeds this into the existing `productIdsIn` `$in` filter (the same mechanism `?size=` already used), intersecting the two when a request names both. `ProductListFilter.collectionId` and its dead `query.collectionIds = ...` line were removed from `product.repository.ts` — nothing else referenced them (confirmed by search).

Live-verified after the fix: the same real collection query now returns exactly its 6 real products, in the right order; the fake-slug query now returns zero, not everything. Three new regression tests added (`collection-automated.integration.test.ts`): a manual collection's real productIds, an automated collection's live rule match, and the unresolvable-slug zero-result case. Full API suite re-confirmed green: 417/417 (414 + 3 new).

---

## 9. Placeholder content — what's real vs. not

**This matters for anyone about to demo this or hand it to the client.** As of P1, the *catalog* is a real database, seeded with realistic-but-invented data — that's a meaningfully different situation from P0, where nothing was real. Still nothing here is licensed or client-approved.

- **Catalogue — now REAL data in MongoDB**, not hand-written arrays: 33 products, 46 categories, 6 brands, 3 collections, all produced by `apps/api/scripts/seed.ts`. Brand names are real (Khaadi, Asim Jofa, Sana Safinaz, Maria B, Gul Ahmed, Elan); article codes, prices, descriptions, and the products themselves are invented. `apps/web/lib/placeholder-data.ts` (the old hand-written 9-product stand-in) still exists in the repo, untouched, but the storefront no longer reads from it for anything catalog-related — only cart/checkout still might, check before removing it.
- **Product/campaign imagery** (`apps/web/public/catalogue/`, `apps/web/public/campaigns/` — 11 + 11 files): royalty-free Unsplash-License fabric/textile macro photography, **deliberately not** scraped photos of the real brands' actual products (that would be unlicensed use of real companies' copyrighted photography) and **deliberately not** real bridal/editorial portraits (likeness concerns, even where the license technically permits reuse). These are still keyed to the *old* placeholder product slugs/names, not the real seeded ones — the real seeded products (`seed.ts`) don't reference these image files at all yet, so real PDP/PLP pages currently render without product photography (or with whatever the placeholder-image mapping still coincidentally catches). All must be replaced with the client's real photography before launch regardless — this is `plan.md` §29 risk #2, not a new risk.
- **Admin data**: as of P3, **every `apps/admin` screen reads/writes the real MongoDB** — Orders, Products, Inventory (P2), Discounts, Customers, Content, Reports, Settings, Users, Audit log (P3, §6.5–§6.11). The only remaining placeholder content in `apps/admin` is the dashboard's four top summary stat tiles (§6.4 — no dedicated dashboard-summary endpoint exists; `report`'s per-category endpoints could back these but nothing wires them there yet) and `lib/placeholder-dashboard.ts`.
- **Cart/checkout** (storefront): real since P2 (§5.4) — client-local state is gone. The checkout UI's payment step is now wired to Ziina's real hosted-redirect flow (§5.4) — `place()` before the redirect, a return route for all three outcomes — genuinely unverified only in the one sense that's still true of the whole `payment` module: no live Ziina account exists yet to actually complete a card payment against (§4.6.4, §11 item 2).
- **Secrets**: `.env` (root, `apps/api/`, `apps/web/`) contain dev-only dummy/generated values (random JWT secrets, `devpassword` for Redis, a shared Meilisearch dev key). Never committed; never used outside this local machine.

---

## 10. Running it locally

```bash
# 1. Infra (Mongo replica set + Redis + Meilisearch)
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps   # all three should show "healthy"

# 2. Copy env templates if not already present
cp .env.example .env                      # root — used by docker compose
cp apps/api/.env.example apps/api/.env    # then set real JWT_ACCESS_SECRET/JWT_REFRESH_SECRET;
                                           # also check MEILI_MASTER_KEY matches the running
                                           # container if you didn't just create it (§8.10)
cp apps/web/.env.example apps/web/.env    # local-dev values already correct as shipped

# 3. Install + build shared packages
pnpm install
pnpm turbo run build --filter=./packages/*

# 4. Seed the catalog (idempotent — safe to rerun)
pnpm --filter @lulwah/api seed

# 4b. Build unique/query indexes for real — autoIndex is deliberately off
# (§8.15). Skipping this means every uniqueness rule (emails, order
# numbers, discount codes, product slugs, ...) is silently unenforced.
# Safe to rerun any time, including after any schema index change.
pnpm --filter @lulwah/api db:sync-indexes

# 5. Run each app (separate terminals)
pnpm --filter @lulwah/api dev      # http://localhost:4000
pnpm --filter @lulwah/web dev      # http://localhost:3000
pnpm --filter @lulwah/admin dev    # http://localhost:3001

# Full verification
pnpm turbo run typecheck lint test build
```

Mongo is on host port **27018** and Redis on **6380** (not the defaults) — see §8.6. If `pnpm turbo run ... test` reports a failure, especially something like "failed to start forks worker" or "Instance failed to start within 10000ms," retry that one package's tests in isolation before assuming it's real — this repo's test suites (`mongodb-memory-server`, Vitest worker pools) are resource-hungry enough that running everything in parallel on one machine produces occasional transient failures that pass cleanly alone. This has happened repeatedly during this build and has never once been a real defect when retried.

---

## 11. Suggested next steps

`plan.md` §28's **P3 — Operations** is now fully done: full admin console (§6.5–§6.11), RBAC applied throughout the new modules, CMS/homepage builder, reports, audit log, and the client-directed Stripe→Ziina gateway swap (§4.6.4). Per §28's own order, the next phase is **R1 LAUNCH** (content load, SEO, analytics, load test, security review, UAT) — but several concrete loose ends are worth closing first:

1. ~~**Wire the storefront checkout UI to Ziina's hosted-redirect flow** — the single biggest remaining piece of unfinished P3 work. `apps/web`'s checkout payment step still reflects the pre-swap (Stripe-era) shape; it needs to actually send the browser to `redirectUrl` and handle the success/cancel/failure return, per `docs/ziina-integration-notes.md`. Deliberately left out of P3's admin-focused agent batch to avoid two workstreams colliding on the same checkout files.~~ **Done** — see §5.4. `place()` now runs before the card redirect (not after, not skipped), a new `checkout/session/[sessionId]/return` route handles all three Ziina outcomes keyed by checkout session id (`orderNumber` added to `CheckoutSessionResponse` to resolve the order afterward), and `cancel`/`failure` render an honest no-retry message. Still genuinely unverified against a *live* Ziina account — that's item 2 below, unchanged.
2. **A real Ziina API key**, whenever the client completes onboarding (Emirates ID required, no self-serve sandbox exists) — `ZiinaGateway` (§4.6.4) is unit-tested against a mocked `fetch` but has never called Ziina's actual API. This is the single biggest remaining "unverified, not unbuilt" gap in the whole commerce path, same status the old `StripeGateway` held before the swap.
3. ~~**Run `pnpm db:sync-indexes` as part of the real deploy pipeline**~~ **Done** — see §8.17. `scripts/deploy.sh` (now a real, checked-in file, along with `rollback.sh`/`smoke.sh`) runs `node dist/scripts/migrate.js` before every rolling restart, exactly as `plan.md` §36.9 always specified; that file itself only became buildable after moving it under `src/` (§8.17's own second bug). Not execution-tested against a real VPS, since none exists for this project — the scripts are syntax-checked and consistent with the real `docker-compose.yml`, but "runs on paper" and "has deployed for real" are different claims here too.
4. ~~**Wire the storefront home page to the new `content` API** (§4.7.3) — Home's editorial sections (Hero, Editorial split, Brand strip, Occasion tiles) are still hardcoded, not CMS-driven, even though the real `GET /content/home` endpoint and full admin homepage builder both now exist. This closes the loop the Content screen's "no live-preview iframe" gap (§6.8) is downstream of.~~ **Done** — see §5.1. All 9 real section types render through their matching existing component in real CMS order; an empty/unusable CMS response falls back to the original fixed §15.2 order, explicitly. Live-verified against the real Docker stack: created one real home section of every type via the admin API (including a `collection_rail` pointed at a real seeded collection), confirmed each rendered correctly through the real running `next dev` server in both `en`/`ar`, confirmed the empty-state fallback by deactivating all sections and re-fetching, then cleaned the test sections back out. Found and fixed a real, separate bug along the way — see §8.19.
5. **Real product photography mapping** — unchanged: the seeded catalog (P1) and the placeholder imagery (P0) don't reference each other. §4.6.6's `imageSnapshot` bug and §5.4's cart-display-cache workaround are both downstream symptoms of this same gap.
6. **Fix the header transparency properly** (§8.4) — unchanged, still low-risk/deferred.
7. **The full §10.2 RBAC permission matrix** — unchanged in spirit; every permission P3's new screens needed was already declared in P0's `identity.policy.ts` ahead of time (only `audit.read` was genuinely new), a second proof the matrix-first approach was worth it.
8. **Users & roles' missing endpoints** (§6.10) — invite staff, force 2FA reset, deactivate, session-list-with-revoke are all named in `plan.md` §11.1 but have no backend anywhere; the admin screen shows them as visibly disabled rather than pretending they work.
9. **Dashboard summary stat tiles** (§6.4, §9) — still placeholder; `report`'s new per-category endpoints (§4.7.4) could back these with a small aggregation, now that they exist.
10. **A real GA4/analytics integration** — `report`'s Traffic category and `plan.md` §23's whole analytics stack remain unbuilt; explicitly out of scope for every phase so far, not forgotten.
11. **P5 returns/RMA workflow** — `Order.items[].returnedQty`/`refundedFils`, `ReturnStatus`, and the `'return'` `StockMovementType` all already exist in the shape the schema anticipated; P2 deliberately built the model support only, not the workflow (endpoints, admin RMA screen, refund-to-gateway calls), per its own brief's scope boundary. P3 built single-order refunds (§4.6.4) but not the broader return-request workflow.
