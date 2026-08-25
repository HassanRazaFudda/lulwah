# LULWAH FASHION — Implemented Plan (progress record against `plan.md`)

## 0. Document control

| Field | Value |
|---|---|
| Document | `implemented-plan.md` — records what has actually been built, where, how, and why it may differ from `plan.md` |
| Companion to | [`plan.md`](./plan.md) — the target architecture/spec. This document never restates decisions `plan.md` already covers; it only records implementation reality and deltas. |
| Status | Phase **P0 (Foundation)**, **P1 (Catalogue)**, and **P2 (Commerce)** complete, per `plan.md` §28's delivery plan. P2's first half (cart, pricing/discount engine, address) landed on `master` as commit `abe5075`; this update covers P2's second half — `checkout`, `order`, `payment` (COD real, Stripe code-complete-but-unverified). |
| As of | 2026-08-25, commit `abe5075` (this document's own commit follows the P2-second-half work) |
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
| **P2 — Commerce** (cart, checkout, discount engine, payments, orders) | **Done**, API-side. `cart`/`pricing`/`address` (first half, commit `abe5075`) plus `checkout`/`order`/`payment` (this update, §4.6): the full §8.7 status state machine, guest + card + COD checkout, Stripe code-complete but never called against a real account, idempotent order placement, live-verified end to end for the COD path. `apps/web`/`apps/admin` are **not** wired to any of this yet — see §4.6's own scope note and §11. |
| P3 — Operations (full admin, RBAC enforcement beyond identity, CMS) | Not started, except the order-status state machine (§6.1, and now real on the API side per §4.6) and the now-real Products/Inventory screens (§6.3) |
| P4 — Experience (GSAP/WebGL, Arabic content, reviews) | Not started |
| P5 — Depth (custom stitching, returns, Aramex, BNPL) | Not started |
| P6 — Hardening | Not started |

**What actually runs today:** `pnpm install && pnpm dev` per app boots a real Express API — auth (P0), a real product/brand/category/collection/inventory catalog (P1), and now cart/discounts/checkout/orders/payments (P2, §4.6) — against real MongoDB/Redis/Meilisearch (in Docker), a storefront rendering real seeded products end to end (home → PLP with working facets → PDP with live stock → search), and an admin console where the Products and Inventory screens are real CRUD against that same API. The full commerce API — guest cart → checkout (address/shipping/COD-OTP/card) → order, with the §8.7 status state machine enforced server-side — is real and live-verified for its COD path (§4.6.5); **`apps/web`'s cart/checkout UI and `apps/admin`'s Orders screen are still local-state/placeholder, not wired to any of it** — that wiring is the next stage, not part of this update. See §10 for exact steps.

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

Express 5.2 modular monolith. **`identity`, `catalog`, `inventory`, `cart`, `pricing`, `checkout`, `order`, and `payment` modules are all built** (this document's §4.1–§4.5 predate `cart`/`pricing`, which landed as commit `abe5075` — see §4.6 for `checkout`/`order`/`payment`, the most recent addition). No stitching, content, engagement, or analytics module exists yet, not even as stubs. The module-boundary lint rule (§5.3) now has real cross-module boundaries to enforce across seven live modules, not just one or two in isolation — §4.6.6 lists the specific narrow extensions this update made to other modules' own exported service surfaces to reach across them correctly.

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

#### 4.6.4 Payment — `PaymentGateway`, COD real, Stripe unverified

`payment-gateway.ts` defines the interface exactly as plan.md §20 names it: `createIntent`, `capture`, `refund`, `verifyWebhook`.

- **`CodGateway`** — fully real, no external API: a 6-digit CSPRNG code (`node:crypto`'s `randomInt`, not `Math.random()`), sha256-hashed at rest (never the raw code), 10-minute TTL, 3-attempt cap, sent via the same logged `notifyStub` used for order notifications. `COD_FEE_FILS`/`COD_MAX_ORDER_FILS` (already in `env.ts` since P1) are enforced at `payment-intent` creation. This is the payment path live-verified end to end (§4.6.5).
- **`StripeGateway`** — implemented for real against the `stripe` npm package (added as a dependency), reads `env.STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`. **Not live-verified against Stripe's actual API** — no real (even test-mode) account is configured for this project, exactly as `env.ts` already anticipated by keeping those vars optional. Code-complete and unit-tested against a hand-rolled mock of the SDK's client shape (7 tests: intent-status mapping for every `Stripe.PaymentIntent.Status`, capture/refund parameter forwarding, webhook signature verification success/failure) — "code-complete" and "actually-called-their-API" are different claims, and only the former is true here. Live-checked that the *unavailable* path is clean: `POST /checkout/session/:id/payment-intent {method:"card"}` against this environment's unconfigured Stripe returns a clean `503 SERVICE_UNAVAILABLE`, not a crash.
- **Webhook** `POST /webhooks/stripe` (§9.6): signature-verified, then deduplicated via a `webhook_events` Mongo collection (unique index on `{provider, eventId}` — insert-or-see-duplicate-key-error, not a read-then-check race) before any processing. The actual processing (one order lookup, a few field writes, `order.confirmed`'s already-fast side effects) is done inline rather than via a separate queue consumer — the brief's own "use your judgement" allowance, since this work is fast enough that the queueing machinery would add complexity without a real benefit at this scale. Never live-tested (no way to receive a real Stripe webhook without an account) — the signature-verification and dedupe logic themselves are unit/integration-tested with synthetic events.

Requires touching `app.ts`'s middleware order: Stripe's signature check needs the *exact* raw request bytes, not a re-serialization of parsed JSON, so `/api/v1/webhooks/stripe` is dispatched to `express.raw()` instead of the global `express.json()` — the one path in the whole API that bypasses the standard body parser, done via a per-request check since Express has no clean "skip global middleware for one path" primitive.

#### 4.6.5 Live-verified vs. test-only — precise, by sub-flow

Against this repo's actual Docker dev stack (real MongoDB replica set on 27018, real Redis on 6380) with the seeded catalog, via direct HTTP (not the test harness):

- **Guest COD checkout, fully live, start to finish**: created a cart, added a real seeded variant, restocked it via the real admin adjust endpoint, created a checkout session (confirmed the product/brand snapshot was captured correctly, including an empty `imageSnapshot` for a variant with no media — see §4.6.6's bug #2), set an inline guest address, got the free-shipping flat-rate quote (subtotal cleared the threshold), created a COD payment intent, read the real OTP out of the server's own log (the notify stub's only "delivery" channel in this environment), verified it, and placed the order with a real `Idempotency-Key` header.
- **Order auto-confirmation, live-confirmed**: the placed order came back `status: "confirmed"` immediately with a two-entry `statusHistory` (`null→pending_payment`, then `pending_payment→confirmed` with the auto-confirm note) — no manual admin action needed for COD, as designed.
- **Stock actually decremented, not just reservation-released — the priority the brief called out explicitly**: queried `GET /admin/inventory/:variantId/movements` directly after placement and got back a real `type: "sale", quantity: -2, before: 20, after: 18` row — `onHand` itself moved, confirmed independently of the reservation that preceded it.
- **Idempotency, live-confirmed**: replayed the identical `place` request with the same `Idempotency-Key` and got `200` (not `201`) back with the exact same order id.
- **Guest tracking, live-confirmed**: `GET /orders/track` with the real order number + guest email returned the reduced public view; the response has no `grandTotalFils`/`payment` fields, confirming the redaction is real, not just described in a comment.
- **Admin status transitions, live-confirmed**: `PATCH /admin/orders/:id/status` moved `confirmed → processing` (valid, `200`); a subsequent attempt at an out-of-table transition as `super_admin` without a `note` correctly came back `400` (reason required), matching the mandatory-reason rule exactly.
- **Card/Stripe: only the *absence* path is live-verified.** Confirmed `payment-intent {method:"card"}` cleanly `503`s in this unconfigured environment. Everything else about `StripeGateway` — actually creating a PaymentIntent, capturing, refunding, receiving a real webhook — is **unit-tested against a mock only**, never exercised against Stripe's real API. Restated because it's the one claim in this section worth being unable to overstate: this code has not talked to Stripe.
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

---

## 5. Storefront — `apps/web` (plan.md §12–§16)

Next.js 16.3 App Router. Route tree matches `plan.md` §12.1 closely (see the file list in §1 above for exact pages). **PLP, PDP, Home's product rails, Brands, and Search now call the real catalog API** (`apps/web/lib/catalog-client.ts` + `api-client.ts`) — this is the main change since P0. Cart/checkout/account remain local-state-only (no backend for them yet).

### 5.1 What's genuinely built out

- **Home** (`app/[locale]/page.tsx`): the fixed §15.2 section order — Hero, New arrivals rail, Shop by stitching (3 panels), Editorial split, Brand strip, Best sellers, Full-bleed break, Occasion tiles, USP bar, Newsletter. New-arrivals and best-sellers rails now pull real products (`sort=newest`/`sort=bestselling`); the rest is static/editorial content, unchanged.
- **PLP** (`shop/[...category]`): filter rail in the exact §15.3 facet order, wired to real facet data and counts, 2-up/3-up grid, "Load more" pagination via `nuqs`. Handles the parent/leaf category mismatch — see §4.4's note. Multi-select facet checkboxes exist in the UI but only the first selected value per facet is actually sent to the API (`ListProductsQuery` doesn't accept multi-value params) — a known, documented gap, not a bug.
- **PDP** (`product/[slug]`): info-column order per §15.4, now rendering real per-variant availability ("In stock" / "Only N left" / "Sold out") from the API's live `VariantWithAvailability[]` instead of a static number. Colour options render as bordered name buttons rather than hex swatches — only a product's primary colourway has a real hex in the schema, a variant-level colour is just a string. 404s render a real not-found page for a bad slug.
- **Brands** (`brands`, `brands/[slug]`) and **Search** (`search`): both wired to the real API; search's zero-result state suggests the three real nearest collections (not fabricated ones), per §15.3's requirement.
- **`ProductCard`** and **`PriceBlock`**: built to the exact §13.6/§8.2 spec (3:4 media, diagonal clip-path hover wipe, tabular price with garnet `-N%` badge shown only when `discountPercent >= 5`) — unit-tested (10 tests covering the rounding/threshold rules specifically). Untouched by the API-wiring work; a thin mapper layer (`lib/product-mappers.ts`) adapts real API responses onto these components' existing prop shapes instead.
- **Header**: real nav, real logo (see §7), scroll-hide behavior. **Not** transparent-over-hero (see §8.4 — this was attempted, found broken, and deliberately simplified to always-solid rather than fixed properly).
- en/ar routing via `next-intl`, RTL logical properties, self-hosted fonts (Bodoni Moda / Archivo / Aref Ruqaa / IBM Plex Sans Arabic) via real Fontsource-sourced files, not placeholders.
- **`app/[locale]/error.tsx` and `not-found.tsx`**: added alongside the real API wiring — a real fetch can fail or 404 now, where placeholder data never did.

### 5.2 Explicitly not built (stated in the original brief, still true)

Mega-menu (four-column crossfading panel), mobile filter bottom-sheet, full brand-history CMS content, GSAP/Lenis/WebGL motion (all R2 per §3.1), real cart/checkout API wiring (UI exists, local component state only — no `cart`/`order` module exists in the API), full Arabic translation (representative message keys only), a working "Size guide" drawer (no per-brand measurement-chart content source exists yet).

### 5.3 Custom `next/image` loader gotcha

`lib/image-loader.ts` implements the §4.1 imgproxy-loader pattern, but **no imgproxy container exists in local dev** (`docker-compose.dev.yml` intentionally only runs mongo/redis/meilisearch, per §25.1). The loader now falls back to serving local assets directly when `NEXT_PUBLIC_IMGPROXY_URL` is unset (see §8.3) — this is what makes local image preview possible at all right now.

---

## 6. Admin console — `apps/admin` (plan.md §11)

Next.js 16.3, client-rendered, `noindex`. All 10 §11.1 screens exist as real shells; **Orders**, **Products**, and **Inventory** have real depth — everything else is still a shell.

### 6.1 The one thing built to spec in full: order status (plan.md §8.7)

- `lib/order-status.ts` — `getValidNextStatuses()` encodes the exact §8.7.2 transition table, including both special cases (`out_for_delivery → shipped` as a rollback; `cancelled → refunded`).
- **32 passing unit tests**, one per state/transition combination in §8.7.1/§8.7.2 — this is the most thoroughly tested piece of the whole build.
- `StatusTransitionDropdown` renders *only* what that function returns — invalid transitions are never in the DOM, matching §8.7.4's explicit requirement literally.
- Wired into a real Orders table + detail page with placeholder orders spanning every status, a shipped-requires-tracking mini-form, and an optimistic-update mutation pattern.

### 6.2 Everything else

Discounts, Customers, Content, Reports, Settings, Users: page shells exist (sidebar nav, page headers, a reusable `DataTable`), minimal-to-no real content. The login page's TOTP field doesn't verify against anything real (no 2FA backend exists) — but login itself is now real, see §6.3.

### 6.3 Products & Inventory — real CRUD against the real catalog API (plan.md §11.1)

- **Products list** (`app/(dashboard)/products/page.tsx`): real `DataTable` against `GET /admin/products` — thumb, brand (joined from `GET /admin/brands`), article code, stitching type, price, stock, status.
- **Product editor** (`products/new`, `products/[id]`), one shared component with all 7 §11.1 tabs: Basics, Attributes (the Pakistani-fashion fields — piece-count builder, per-piece editor, fabric/work/occasion/season/colour), Media (paste-a-URL, since no upload/S3 pipeline exists — confirmed, not silently under-built), Variants (size×colour matrix generator), Pricing, Inventory (mandatory-reason stock adjust), Publishing. Media/Variants/Inventory tabs are disabled until a product is saved once, since those endpoints nest under `/admin/products/:id/...`.
- **Inventory** (`app/(dashboard)/inventory/`, list + `[variantId]` detail): real low/out-of-stock/search filters, mandatory-reason adjustment with client-side validation mirroring the API's Zod rules, per-variant movement history.
- **A real bug found and fixed here**: `lib/api-client.ts` sent `credentials: 'include'` but never attached `Authorization: Bearer <token>` — every RBAC-gated admin call would 401 regardless of how correct the rest of the admin UI was. Fixed alongside a login-page/schema correction (the old version expected a placeholder response shape and a `totpCode` field the real `/auth/login` endpoint doesn't accept).
- **What's read-only or absent, deliberately**: `lowStockThreshold`/`allowBackorder` show read-only in the Inventory tab (no update endpoint exists — those are set only at `InventoryItem` creation); no media delete/reorder (API only has `POST`, no `PATCH`/`DELETE`); no product-delete UI (soft-delete via `status: archived` is the intended path); no pricing/discount UI beyond the two real fields (no discount engine exists).
- 13 new unit tests (`lib/product-editor.test.ts`, the variant-matrix/piece-builder pure logic) alongside the pre-existing 32 — 45 total in this app now.

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

---

## 9. Placeholder content — what's real vs. not

**This matters for anyone about to demo this or hand it to the client.** As of P1, the *catalog* is a real database, seeded with realistic-but-invented data — that's a meaningfully different situation from P0, where nothing was real. Still nothing here is licensed or client-approved.

- **Catalogue — now REAL data in MongoDB**, not hand-written arrays: 33 products, 46 categories, 6 brands, 3 collections, all produced by `apps/api/scripts/seed.ts`. Brand names are real (Khaadi, Asim Jofa, Sana Safinaz, Maria B, Gul Ahmed, Elan); article codes, prices, descriptions, and the products themselves are invented. `apps/web/lib/placeholder-data.ts` (the old hand-written 9-product stand-in) still exists in the repo, untouched, but the storefront no longer reads from it for anything catalog-related — only cart/checkout still might, check before removing it.
- **Product/campaign imagery** (`apps/web/public/catalogue/`, `apps/web/public/campaigns/` — 11 + 11 files): royalty-free Unsplash-License fabric/textile macro photography, **deliberately not** scraped photos of the real brands' actual products (that would be unlicensed use of real companies' copyrighted photography) and **deliberately not** real bridal/editorial portraits (likeness concerns, even where the license technically permits reuse). These are still keyed to the *old* placeholder product slugs/names, not the real seeded ones — the real seeded products (`seed.ts`) don't reference these image files at all yet, so real PDP/PLP pages currently render without product photography (or with whatever the placeholder-image mapping still coincidentally catches). All must be replaced with the client's real photography before launch regardless — this is `plan.md` §29 risk #2, not a new risk.
- **Admin data**: Orders and dashboard stats in `apps/admin` are still hand-written placeholder arrays — the real `order`/`checkout`/`payment` API modules exist and are live-verified (§4.6) but **`apps/admin`'s Orders screen has not been wired to them**; that's the next stage, not part of this update. **Products and Inventory are real** — the admin console reads/writes the same MongoDB the storefront reads from.
- **Cart/checkout** (storefront): `apps/web`'s cart/checkout UI is still client-local state (`useCartStore`), not wired to the real API — the real `cart`, `pricing`, `checkout`, `order`, and `payment` API modules all exist now (P2, complete on the API side per §4.6) and are ready to be consumed; connecting the storefront's UI to them is the next stage.
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

`plan.md` §28's **P2 — Commerce** is now done on the API side (§4.6): cart, discount engine, checkout, order, COD end-to-end, Stripe code-complete-but-unverified. Nothing in P2 touched `apps/web`/`apps/admin` — that consumption gap is now the most valuable next work, ahead of moving on to P3. In priority order:

1. **Wire `apps/web`'s cart/checkout UI to the real API.** `useCartStore`'s local state needs to become a thin client over `POST /cart`, `/cart/:id/items`, `/checkout/session*`, `/checkout/cod/verify-otp`, `/checkout/session/:id/place`. This is the single highest-value next step — every commerce module built in this update is real and tested but has no UI consumer yet.
2. **Wire `apps/admin`'s Orders screen to the real API.** The state-machine UI (`StatusTransitionDropdown`, `getValidNextStatuses` — §6.1) already exists and is exactly what the new `PATCH /admin/orders/:id/status` endpoint expects; today it still renders hand-written placeholder order data instead of `GET /admin/orders`. Swapping the data source is comparatively little work for a lot of realism.
3. **A real Stripe test-mode account**, whenever one becomes available — `StripeGateway` (§4.6.4) is unit-tested against a mock but has never called Stripe's actual API. Getting a test key would let the card checkout path, the webhook handler, and `payment_intent.succeeded`/`payment_intent.payment_failed` handling all move from "code-complete" to "actually verified."
4. **Real product photography mapping** — unchanged from the previous edition of this section: the seeded catalog (P1) and the placeholder imagery (P0) don't reference each other. This update's live checkout pass surfaced a concrete consequence of the gap (§4.6.6's `imageSnapshot` bug) — a real fix here removes a whole class of empty-image edge cases downstream, not just a cosmetic one.
5. **Fix the header transparency properly** (§8.4) — unchanged, still low-risk/deferred.
6. **The full §10.2 RBAC permission matrix** — unchanged; `orders.read`/`orders.status.update` were already declared ahead of time and slotted straight into `order`'s routes with no identity-module changes needed, which is a small proof the matrix-first approach was worth it — worth finishing for the same reason.
7. **P5 returns/RMA workflow** — `Order.items[].returnedQty`/`refundedFils`, `ReturnStatus`, and the `'return'` `StockMovementType` all already exist in the shape the schema anticipated; this update deliberately built the model support only, not the workflow (endpoints, admin RMA screen, refund-to-gateway calls), per its own brief's scope boundary.
