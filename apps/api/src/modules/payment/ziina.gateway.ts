import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../../shared/errors.js';
import type {
  CaptureParams,
  CaptureResult,
  CreateIntentParams,
  CreateIntentResult,
  IntentStatus,
  PaymentGateway,
  RefundParams,
  RefundResult,
  VerifyWebhookParams,
  VerifyWebhookResult,
} from './payment-gateway.js';

/**
 * `ZiinaGateway` — plan.md §20's `PaymentGateway` interface against
 * Ziina's plain REST API (no official Node SDK exists, unlike Stripe — see
 * `docs/ziina-integration-notes.md`, compiled directly from
 * https://docs.ziina.com). Native `fetch` (Node 24) + `node:crypto`, no
 * new npm dependency.
 *
 * **Not live-verified against Ziina's actual API** — there is no self-serve
 * sandbox signup (docs §2: onboarding requires an Emirates ID via the
 * Ziina business dashboard), so no real (even test-mode) key is configured
 * for this project, same posture the original `StripeGateway` had.
 * Correct per this file's own request/response mapping and this module's
 * unit tests (which mock `fetch`, see `__tests__/ziina.gateway.test.ts`),
 * not verified against a live or even sandboxed Ziina endpoint —
 * "code-complete" and "actually-called-their-API" are different claims.
 *
 * AED's smallest unit is fils (1/100 of a dirham) — the same integer this
 * codebase already stores everywhere as `*Fils` (plan.md §8.1). Ziina's
 * `amount` field wants "base currency units" per the docs, which the notes
 * confirm already matches our fils convention — `amountFils` passes
 * straight through with no conversion, same as it did for Stripe.
 */

const ZIINA_API_BASE_URL = 'https://api-v2.ziina.com/api';

const ZiinaPaymentIntentStatus = z.enum(['requires_payment_instrument', 'requires_user_action', 'pending', 'completed', 'failed', 'canceled']);

/** Zod-parsed defensively (not assumed complete) — the docs' own words:
 *  "docs don't give a full example; code defensively." `.passthrough()` so
 *  fields Ziina adds later don't break parsing of the ones we use. */
const ZiinaPaymentIntentResponse = z
  .object({
    id: z.string(),
    status: ZiinaPaymentIntentStatus,
    amount: z.number().optional(),
    redirect_url: z.string().nullable().optional(),
  })
  .passthrough();

const ZiinaRefundResponse = z
  .object({
    id: z.string(),
    payment_intent_id: z.string(),
    amount: z.number(),
    status: z.enum(['pending', 'completed', 'failed']),
  })
  .passthrough();

const ZiinaWebhookPayload = z.object({
  event: z.string(),
  data: z.unknown(),
});

/** Only used to build a stable dedupe key when the webhook payload actually
 *  has the shape we expect (see `verifyWebhook`'s doc comment on why
 *  there's no Stripe-style `evt_...` id to use instead). */
const ZiinaWebhookDataIdentity = z.object({ id: z.string(), status: z.string() }).passthrough();

/** docs §5's suggested mapping into the existing gateway-neutral
 *  `IntentStatus` union — exported so a future caller (a status-polling
 *  endpoint, say) doesn't have to re-derive it. */
export function mapZiinaStatus(status: z.infer<typeof ZiinaPaymentIntentStatus>): IntentStatus {
  switch (status) {
    case 'completed':
      return 'succeeded';
    case 'pending':
      return 'processing';
    case 'requires_payment_instrument':
    case 'requires_user_action':
      return 'requires_action';
    case 'failed':
    case 'canceled':
    default:
      return 'failed';
  }
}

export class ZiinaGateway implements PaymentGateway {
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly fetchImpl: typeof fetch;

  /** `fetchImpl` is injectable for tests — a real global `fetch` in
   *  `payment.service.ts`'s live wiring, a `vi.fn()` stand-in in unit
   *  tests, never a real network call from a test (same DI pattern the
   *  original `StripeGateway` used for its SDK client). */
  constructor(apiKey: string, webhookSecret: string, fetchImpl: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
    this.fetchImpl = fetchImpl;
  }

  private async request(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<unknown> {
    const res = await this.fetchImpl(`${ZIINA_API_BASE_URL}${path}`, {
      method: init.method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      throw new AppError('PAYMENT_FAILED', 502, { messageEn: 'Ziina request failed.', details: { status: res.status, path, body: json } });
    }
    return json;
  }

  async createIntent(params: CreateIntentParams): Promise<CreateIntentResult> {
    const body = await this.request('/payment_intent', {
      method: 'POST',
      body: {
        amount: params.amountFils,
        currency_code: params.currency,
        // Client-generated UUID, for Ziina-side retry idempotency (docs
        // §3) — generated once per attempt, the same way `checkout`'s own
        // `Idempotency-Key` is generated per `place` attempt. Not the same
        // key as `params.reference` (our checkout session id) — Ziina has
        // no generic metadata field to carry that through (unlike
        // Stripe's `metadata`); correlation back to our order instead
        // happens the way it always has, via storing the returned
        // `intentId` as `Order.payment.intentId` (see
        // `order.repository.ts#findOrderByPaymentIntentId`).
        operation_id: randomUUID(),
        // All three documented-optional on Ziina's API (docs §3) — omitted
        // from the body entirely when null rather than sent as literal
        // `null`, matching how every other optional field on this request
        // is already handled (`message`/`expiry`/`allow_tips` are never
        // sent by this codebase at all, same reasoning). `CodGateway`
        // never reaches this method (see its own doc comment), so `null`
        // here in practice only ever means "not yet wired by the caller,"
        // not "COD."
        ...(params.successUrl ? { success_url: params.successUrl } : {}),
        ...(params.cancelUrl ? { cancel_url: params.cancelUrl } : {}),
        ...(params.failureUrl ? { failure_url: params.failureUrl } : {}),
      },
    });
    const parsed = ZiinaPaymentIntentResponse.parse(body);
    return { intentId: parsed.id, redirectUrl: parsed.redirect_url ?? null, status: mapZiinaStatus(parsed.status) };
  }

  /** Status-passthrough, not a real capture — see `PaymentGateway#capture`'s
   *  doc comment for why. */
  async capture(params: CaptureParams): Promise<CaptureResult> {
    const body = await this.request(`/payment_intent/${params.intentId}`, { method: 'GET' });
    const parsed = ZiinaPaymentIntentResponse.parse(body);
    return { intentId: parsed.id, status: mapZiinaStatus(parsed.status), capturedFils: parsed.amount ?? 0 };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const body = await this.request('/refund', {
      method: 'POST',
      body: { id: randomUUID(), payment_intent_id: params.intentId, amount: params.amountFils },
    });
    const parsed = ZiinaRefundResponse.parse(body);
    return { refundId: parsed.id, status: parsed.status, amountFils: parsed.amount };
  }

  /** Sync (see `PaymentGateway`'s doc comment) — HMAC-SHA256 of the raw
   *  body against `webhookSecret`, hex-encoded, compared with
   *  `crypto.timingSafeEqual` rather than `===`: this is money-handling
   *  code, and a plain string/byte comparison short-circuits on the first
   *  mismatching byte, which is a real (if narrow) timing side-channel for
   *  an attacker trying to forge a signature. Lengths are compared first
   *  (not itself a meaningful leak — a valid hex-SHA256 signature is
   *  always 64 characters) purely so a malformed header can never reach
   *  `timingSafeEqual` with mismatched buffer lengths, which throws
   *  `RangeError` rather than returning `false`. */
  verifyWebhook(params: VerifyWebhookParams): VerifyWebhookResult {
    if (!params.signatureHeader) {
      throw new AppError('PAYMENT_FAILED', 400, { messageEn: 'Missing Ziina signature header.' });
    }
    const rawBuf = Buffer.isBuffer(params.rawBody) ? params.rawBody : Buffer.from(params.rawBody, 'utf8');

    const expectedHex = createHmac('sha256', this.webhookSecret).update(rawBuf).digest('hex');
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const providedBuf = Buffer.from(params.signatureHeader, 'hex');
    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
      throw new AppError('PAYMENT_FAILED', 400, { messageEn: 'Invalid Ziina webhook signature.' });
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBuf.toString('utf8'));
    } catch (err) {
      throw new AppError('PAYMENT_FAILED', 400, { messageEn: 'Invalid Ziina webhook payload — not valid JSON.', cause: err });
    }
    const payload = ZiinaWebhookPayload.safeParse(json);
    if (!payload.success) {
      throw new AppError('PAYMENT_FAILED', 400, { messageEn: 'Invalid Ziina webhook payload shape.' });
    }

    // Ziina's webhook payload (docs §6) has no distinct event id, unlike
    // Stripe's `evt_...` — `webhook-event.repository.ts`'s dedupe still
    // needs a stable per-event key, so this constructs one from the
    // payment intent id + its status. That's stable across a *retried*
    // delivery of the identical event (Ziina retries a non-2xx response
    // verbatim, docs §6), and distinct per actual status transition, which
    // is the granularity that matters for `recordCardPaymentResult`'s
    // idempotency. Falls back to a fresh UUID (never dedupes, always
    // processed) only if the payload is missing `id`/`status` entirely —
    // `payment.service.ts#processZiinaEvent`'s own defensive parse will
    // then skip it anyway.
    const identity = ZiinaWebhookDataIdentity.safeParse(payload.data.data);
    const eventId = identity.success ? `${identity.data.id}:${identity.data.status}` : randomUUID();

    return { eventId, type: payload.data.event, data: payload.data.data };
  }
}
