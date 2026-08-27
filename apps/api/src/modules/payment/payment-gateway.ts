import type { PaymentMethod } from '@lulwah/contracts';

/**
 * `PaymentGateway` — plan.md §20: "provider-agnostic... `createIntent`,
 * `capture`, `refund`, `verifyWebhook`." Every concrete gateway
 * (`CodGateway`, `ZiinaGateway`) implements this one interface;
 * `payment.service.ts` is the only place that picks which one to use for a
 * given `PaymentMethod` — nothing else in the codebase imports a concrete
 * gateway class directly.
 *
 * Card payments were originally built against Stripe; the client switched
 * to **Ziina** (a UAE-native hosted-redirect gateway, no client-side SDK —
 * see `docs/ziina-integration-notes.md` and plan.md §20) before a live
 * Stripe account ever existed for this project. This interface stayed
 * provider-agnostic through that swap: `ZiinaGateway` replaced
 * `StripeGateway` as the one concrete implementation behind
 * `PaymentMethod: 'card'`, with two shape changes forced by the
 * hosted-redirect model — see `CreateIntentResult.redirectUrl` and
 * `capture()`'s own doc comment below.
 */

export interface CreateIntentParams {
  /** A stable string identifying what's being paid for before an `Order`
   *  exists yet — `checkout`'s session id. Carried as gateway metadata so a
   *  webhook/support ticket can be traced back to it. */
  reference: string;
  amountFils: number;
  currency: 'AED';
  method: PaymentMethod;
  customerEmail: string | null;
  customerPhone: string | null;
  metadata?: Record<string, string>;
}

export type IntentStatus = 'requires_action' | 'requires_confirmation' | 'requires_capture' | 'processing' | 'succeeded' | 'failed';

export interface CreateIntentResult {
  intentId: string;
  /** Renamed from the original `clientSecret` (a Stripe-only, client-side
   *  confirmation concept with no Ziina equivalent — Ziina has no
   *  Elements-style device confirmation flow). Ziina is a *hosted-redirect*
   *  gateway: `createIntent` returns a URL, the browser is sent to it
   *  (card entry/3DS/Apple Pay/Google Pay all happen off our domain on
   *  Ziina's own page), and Ziina redirects back to a success/cancel/
   *  failure URL — the webhook, not the redirect, is what actually
   *  confirms the order (see `payment.service.ts#handleZiinaWebhook`).
   *  `null` for gateways with no redirect step (COD). The only two
   *  callers of this field are `checkout.service.ts#createPaymentIntent`
   *  (assigns it straight onto `PaymentIntentResponse.redirectUrl`, its
   *  own DTO — renamed identically, see that file) and this module's own
   *  gateway implementations/tests; nothing in `@lulwah/contracts` or
   *  `apps/web` referenced the old name, so this was a clean rename, not
   *  an additive field. */
  redirectUrl: string | null;
  status: IntentStatus;
}

export interface CaptureParams {
  intentId: string;
  /** Partial capture amount; omit to capture the full authorized amount.
   *  Meaningless for `ZiinaGateway` (see `capture()`'s doc comment below) —
   *  kept on the shared params type for gateways that do have a real
   *  authorize/capture split, so the interface doesn't shrink to fit its
   *  currently-least-capable implementation. */
  amountFils?: number;
}

export interface CaptureResult {
  intentId: string;
  status: IntentStatus;
  capturedFils: number;
}

export interface RefundParams {
  intentId: string;
  amountFils: number;
  reason?: string;
}

export interface RefundResult {
  refundId: string;
  status: string;
  amountFils: number;
}

export interface VerifyWebhookParams {
  rawBody: string | Buffer;
  signatureHeader: string | undefined;
}

export interface VerifyWebhookResult {
  eventId: string;
  type: string;
  data: unknown;
}

export interface PaymentGateway {
  createIntent(params: CreateIntentParams): Promise<CreateIntentResult>;
  /** Ziina has no separate capture step — a payment intent moves
   *  `pending` → `completed` directly and funds move at that point (docs
   *  §1). Checked directly: nothing outside this module's own gateway
   *  classes calls `capture()` today (`payment.service.ts`/
   *  `checkout.service.ts`/`order.service.ts` all confirm/settle a card
   *  order purely from the webhook, never a capture call) — so
   *  `ZiinaGateway#capture` is implemented as a **status-passthrough**:
   *  `GET /payment_intent/{id}` and report whatever status Ziina already
   *  has, not a real authorize→capture transition. Kept on the interface
   *  (rather than narrowed away) since a future gateway with a real manual-
   *  capture flow may still want it, and every current caller is generic
   *  over `PaymentGateway`. */
  capture(params: CaptureParams): Promise<CaptureResult>;
  refund(params: RefundParams): Promise<RefundResult>;
  /** Synchronous by design — an HMAC-SHA256 signature check (Ziina:
   *  `X-Hmac-Signature`, `crypto.createHmac('sha256', secret)` over the
   *  raw body) is pure CPU work, and there is no legitimate reason it
   *  should ever need I/O. */
  verifyWebhook(params: VerifyWebhookParams): VerifyWebhookResult;
}
