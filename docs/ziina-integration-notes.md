# Ziina API — integration notes for `lulwah`

Compiled 2026-08-25 from the live docs at https://docs.ziina.com (fetched directly —
not from training data, which predates Ziina's public API). Read this before touching
the payment module. If anything here looks like it might have changed, re-fetch the
specific page under https://docs.ziina.com/api-reference/ rather than guessing.

The client replaces **Stripe** with **Ziina** as the card-payment gateway (Ziina is
the dominant UAE consumer payment app; Stripe is not commonly used by UAE merchants).
COD is unaffected. `PaymentGateway` (plan.md §20) stays provider-agnostic — this is
meant to be a new adapter, not a rewrite of checkout/order.

## 1. Shape of the integration: hosted redirect, not client-side Elements

This is the most important structural fact and the reason a straight find/replace of
`StripeGateway` won't work: **Ziina has no client-side SDK / Elements / PaymentIntent
confirm-on-device flow.** It is a *hosted payment page* redirect model, closer to
Stripe Checkout (redirect) than Stripe Elements (embed):

1. Server creates a payment intent → gets back a `redirect_url` (and an `embedded_url`
   for an iframe option, unused here).
2. Browser is sent to `redirect_url` (Ziina's own hosted page — card entry, 3DS, Apple
   Pay/Google Pay all happen there, off our domain).
3. Ziina redirects the browser back to whichever of `success_url` / `cancel_url` /
   `failure_url` matches the outcome.
4. Ziina also POSTs a webhook (`payment_intent.status.updated`) — this is the
   source of truth for order confirmation, exactly like the existing Stripe webhook
   pattern; the redirect is UX only, never trusted to place/confirm an order by
   itself (same rule the plan already states for Stripe, §19: "Amounts re-verified
   server-side against the order before capture").

There is no separate "capture" step — a Ziina payment intent goes `pending` →
`completed` directly; the funds move at that point. `PaymentGateway.capture()` has no
real Ziina equivalent. Two reasonable options: (a) make it a no-op passthrough that
GETs the intent and returns its current status (since nothing to "capture" — it's
already captured by the time status is `completed`), or (b) narrow the interface if
`capture()` turns out to be unused by anything except the Stripe manual-capture path.
Decide after reading how `payment.service.ts` / `order.service.ts` actually call
`capture()` today — don't guess blind.

## 2. Auth & base URL

- Base URL: `https://api-v2.ziina.com/api`
- `Authorization: Bearer <API_KEY>` on every request.
- The API key is obtained manually via the Ziina business dashboard
  (https://ziina.com/business/connect → "Other builder or custom" → phone/OTP/email
  → onboarding, Emirates ID required) — **there is no self-serve sandbox signup**,
  so `ZIINA_API_KEY` will be unset in this dev environment. Same posture as Stripe
  currently: build and test against mocks/contract tests, document as
  code-complete-but-unverified-against-a-live-account until the client supplies a
  real key. Do not block the build on having a real key.
- No separate sandbox base URL. Test mode is a **per-request flag**: `test: true` on
  the payment-intent create body. Test payment intents "do not require a payment
  method" (per docs) — treat this as the equivalent of Stripe test-mode keys.

## 3. Create payment intent

`POST /payment_intent`

Request body:

| field | type | required | notes |
|---|---|---|---|
| `amount` | number | yes | base currency units — same convention as our `Fils` (AED fils, ×100), no conversion needed beyond what already exists |
| `currency_code` | string | yes | 3-letter ISO-4217, `"AED"` |
| `message` | string | no | shown to the customer on the hosted page |
| `success_url` | string | no | redirect target on success |
| `cancel_url` | string | no | redirect target on cancel |
| `failure_url` | string | no | redirect target on failure |
| `test` | boolean | no | test payment, no real payment method required |
| `expiry` | string | no | unix ms timestamp, must be future |
| `allow_tips` | boolean | no | default false — leave false, not relevant to this store |

Response body:

| field | type | notes |
|---|---|---|
| `id` | string | payment intent id — this is what we store as `intentId` |
| `account_id` | string | our connected Ziina account |
| `amount`, `tip_amount`, `fee_amount` | number | |
| `currency_code` | string | |
| `created_at` | string | unix ms |
| `status` | enum | `requires_payment_instrument` \| `requires_user_action` \| `pending` \| `completed` \| `failed` \| `canceled` |
| `operation_id` | string | client-generated UUID, for retry idempotency — generate one per attempt the same way the existing checkout idempotency key is generated |
| `message` | string | |
| `redirect_url` | string | **send the browser here** |
| `embedded_url` | string | iframe alternative — not used |
| `success_url`, `cancel_url` | string | echoed back |
| `latest_error` | `{ message, code }` \| null | |
| `allow_tips` | boolean | |

## 4. Get payment intent (status polling / server-side re-verification)

`GET /payment_intent/{id}` — same response shape as create. Use this to
re-verify status server-side before trusting a return-redirect (never trust
`success_url` alone), and as a fallback if a webhook is ever missed.

## 5. Status mapping to our `IntentStatus`

Suggested mapping into the existing `IntentStatus` union
(`'requires_action' | 'requires_confirmation' | 'requires_capture' | 'processing' |
'succeeded' | 'failed'`) — adjust the union itself if a Ziina status doesn't fit
rather than forcing a bad mapping:

| Ziina `status` | our `IntentStatus` |
|---|---|
| `requires_payment_instrument` | `requires_action` (send to `redirect_url`) |
| `requires_user_action` | `requires_action` |
| `pending` | `processing` |
| `completed` | `succeeded` |
| `failed` | `failed` |
| `canceled` | `failed` (or add a `canceled` member if the order state machine wants to distinguish cancel-by-customer from a hard failure — check `order.transitions.ts` / `order.service.ts` for how the Stripe `failed`/`canceled` webhook events are currently handled before deciding) |

## 6. Webhooks

`POST /webhook` — **registers/overwrites** the one webhook URL for the whole
account (per docs: "Any subsequent calls to this endpoint will overwrite the webhook
URL for your account"). This is an account-config call (run once via a setup
script/admin action against the live account), not a per-request thing — don't call
it from the checkout hot path.

Request: `{ url: string, secret?: string }`. We should always set `secret`
(our own generated value, stored as `ZIINA_WEBHOOK_SECRET`) since it gates signature
verification.

Delivery: only one event exists today — `payment_intent.status.updated`. Payload:
`{ event: string, data: {...same shape as the payment intent...} }` (docs don't give
a full example; treat `data` as the payment-intent object from §3/§4 and code
defensively — Zod-parse it, don't assume every field is present).

**Signature verification**: header `X-Hmac-Signature`, HMAC-SHA256 of the raw request
body using `secret`, hex-encoded. Same pattern as the existing Stripe
`constructEvent`/`verifyWebhook` — HMAC over the *raw* bytes, so this needs the same
`express.raw()` carve-out around `express.json()` that `STRIPE_WEBHOOK_PATH` already
gets in `app.ts` (just repoint it at `/webhooks/ziina`, same raw-body requirement).

Ziina also documents 4 fixed source IPs for defence-in-depth (optional, secondary to
signature verification — do not rely on IP allowlisting alone, it's not documented as
stable/guaranteed):
`3.29.184.186`, `3.29.190.95`, `20.233.47.127`, `13.202.161.181`.

Retries: Ziina retries a non-2xx webhook response 3×. The existing
`webhook-event.model.ts` / `webhook-event.repository.ts` idempotency-by-event-id
pattern (already built for Stripe) should carry over unchanged — reuse it, don't
rebuild it.

## 7. Refunds

`POST /refund` — requires a `write_refunds`-scoped key (should be included by
default for a direct merchant API key; flag it if the live key turns out to be
scoped differently).

Request: `{ id: <client-generated UUID>, payment_intent_id: string, amount?: number,
currency_code?: string, test?: boolean }`. `amount` omitted = full refund (verify this
assumption isn't contradicted once a live key exists — docs don't fully spell out the
omitted-amount behavior, so add a defensive comment).

Response: `{ id, payment_intent_id, amount, currency_code, status:
'pending'|'completed'|'failed', created_at, error }`.

`GET /refund/{id}` exists for status polling too.

## 8. Test cards (only usable when Ziina issues us a real test-capable key)

Visa `4242 4242 4242 4242` / `4000 0000 0000 0002`, Mastercard
`5555 5555 5555 4444` / `5200 8282 8282 8210`, Amex `3782 822463 10005` /
`3714 496353 98431`. Any future expiry, any CVV of the right length. These only work
with `test: true` and a real (if test-scoped) key — cannot be exercised in this repo's
CI without one, same limitation as the current Stripe test suite (mocked HTTP calls,
not a live account).

## 9. What does NOT change

- `CodGateway` — untouched, COD stays real and independent of this swap.
- The order status state machine (`order.transitions.ts`) — payment status feeds into
  it the same way regardless of which card gateway is behind it.
- `webhook-event.model.ts` / repository idempotency pattern — reused as-is.
- The `Fils` / `SignedFils` money contracts — no unit conversion changes; Ziina's
  "base units" convention already matches how we store AED fils.

## 10. Env vars (rename from Stripe, keep the same "may be unset" posture)

Replace in `.env.example` (root) and `apps/api/src/shared/env.ts`:

```
ZIINA_API_KEY=change_me
ZIINA_WEBHOOK_SECRET=change_me
```

Drop `STRIPE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` entirely — there
is no publishable/client-side key in the hosted-redirect model, nothing for the
storefront to hold. The storefront only needs to know where to send the browser
(`redirect_url`, returned from our own `/checkout/session/:id/payment-intent`
endpoint) and which of our own routes are the `success_url`/`cancel_url`/
`failure_url` targets (point these at the existing
`/[locale]/(checkout)/checkout/confirmation/[order]` route and a new
cancelled/failed variant — the agent doing the storefront half should decide the
exact routes).
