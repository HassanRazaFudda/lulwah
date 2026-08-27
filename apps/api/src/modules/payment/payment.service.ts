import { z } from 'zod';
import type { PaymentMethod } from '@lulwah/contracts';
import { env } from '../../shared/env.js';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import * as orderService from '../order/order.service.js';
import { CodGateway } from './cod.gateway.js';
import type { VerifyOtpResult } from './cod.gateway.js';
import { ZiinaGateway } from './ziina.gateway.js';
import * as webhookRepo from './webhook-event.repository.js';
import type { CreateIntentParams, CreateIntentResult, RefundResult } from './payment-gateway.js';

/**
 * ALL payment orchestration lives here, framework-free (no `express` — plan.md
 * §5.4). Picks the right `PaymentGateway` for a `PaymentMethod`; `checkout
 * .service.ts` and `payment.controller.ts` never construct a concrete
 * gateway class themselves.
 */

const codGateway = new CodGateway();

function ziinaGateway(): ZiinaGateway {
  if (!env.ZIINA_API_KEY || !env.ZIINA_WEBHOOK_SECRET) {
    // No real (even test-mode) Ziina account is configured for this
    // project (see `env.ts`'s doc comment) — this is the one place that
    // becomes visible to a caller, as a clean 503 rather than a crash deep
    // inside a `fetch` call with an empty bearer token.
    throw new AppError('SERVICE_UNAVAILABLE', 503, { messageEn: 'Card payments are not configured yet.' });
  }
  return new ZiinaGateway(env.ZIINA_API_KEY, env.ZIINA_WEBHOOK_SECRET);
}

// ---------------------------------------------------------------------------
// Card (Ziina)
// ---------------------------------------------------------------------------

export async function createCardIntent(params: Omit<CreateIntentParams, 'method'>): Promise<CreateIntentResult> {
  return ziinaGateway().createIntent({ ...params, method: 'card' });
}

// ---------------------------------------------------------------------------
// COD
// ---------------------------------------------------------------------------

export async function requestCodOtp(checkoutSessionId: string, phone: string): Promise<{ intentId: string }> {
  return codGateway.requestOtp(checkoutSessionId, phone);
}

export async function verifyCodOtp(checkoutSessionId: string, code: string): Promise<VerifyOtpResult> {
  return codGateway.verifyOtp(checkoutSessionId, code);
}

// ---------------------------------------------------------------------------
// Refunds — plan.md §8.8. `order.service.ts#refundOrder` (the admin-facing
// entry point, `POST /admin/orders/:id/refund`) calls this after it has
// already resolved "amount omitted = full refund" into a concrete
// `amountFils` (it has `order.paidFils`/`refundedFils` to compute that
// from; this function doesn't need to know an order exists at all) —
// `PaymentGateway#refund`'s `amountFils` stays required, so there was no
// need to widen that interface for this feature.
// ---------------------------------------------------------------------------

export interface RefundOrderPayment {
  method: PaymentMethod;
  gateway: string | null;
  intentId: string | null;
}

/** Dispatches to whichever gateway actually took the original payment.
 *  Only `cod`/`card` are reachable in practice — `checkout.service.ts
 *  #createPaymentIntent` already rejects every other `PaymentMethod` with a
 *  503 before an order can ever be placed with one, so no order in this
 *  build's data ever has `payment.method` outside those two. */
export async function refundOrder(payment: RefundOrderPayment, amountFils: number, reason?: string): Promise<RefundResult> {
  // `RefundParams.reason` is `?: string` under this project's
  // `exactOptionalPropertyTypes: true` (plan.md §27.1) — an explicit
  // `reason: undefined` property is a different thing from an absent one,
  // so this is built conditionally rather than passed straight through.
  const refundParams = (intentId: string) => ({ intentId, amountFils, ...(reason !== undefined ? { reason } : {}) });

  if (payment.method === 'cod') {
    // CodGateway#refund is a logged no-op (plan.md §8.8: COD refunds go to
    // bank transfer or store credit, R3 — no online charge exists here to
    // reverse). `intentId` is COD's OTP-record id, always set once a COD
    // order reached `paid` (see `payment.service.ts#requestCodOtp`).
    return codGateway.refund(refundParams(payment.intentId ?? ''));
  }
  if (payment.method === 'card') {
    if (!payment.intentId) {
      throw new AppError('PAYMENT_FAILED', 400, { messageEn: 'This order has no payment intent to refund.' });
    }
    return ziinaGateway().refund(refundParams(payment.intentId));
  }
  throw new AppError('SERVICE_UNAVAILABLE', 503, { messageEn: 'Refunds are not supported for this payment method yet.' });
}

// ---------------------------------------------------------------------------
// Ziina webhook — plan.md §9.6: verify signature → idempotency check →
// (if unseen) persist + process → 200 within 5s, never blocking on slow
// work. The actual work here (one order lookup, a handful of field writes,
// `order.confirmed`'s already-fast side effects) genuinely is fast enough
// to just do inline, per the brief's own "use your judgement" allowance —
// no separate queue consumer built for this. Structurally identical to the
// original Stripe webhook handler this replaced; only the event shape and
// status vocabulary changed (Ziina: one event type, `payment_intent
// .status.updated`, payload `{event, data}` where `data` is the payment
// intent object — see `docs/ziina-integration-notes.md` §6).
// ---------------------------------------------------------------------------

export interface HandleZiinaWebhookResult {
  /** `false` when the event had already been processed — the controller
   *  still responds 200 either way (plan.md §9.6), this is only for
   *  logging/tests to tell the two cases apart. */
  processed: boolean;
}

export async function handleZiinaWebhook(rawBody: string | Buffer, signatureHeader: string | undefined): Promise<HandleZiinaWebhookResult> {
  const event = ziinaGateway().verifyWebhook({ rawBody, signatureHeader });

  const claimed = await webhookRepo.tryClaimWebhookEvent('ziina', event.eventId, event.type);
  if (!claimed) {
    logger.info({ eventId: event.eventId, type: event.type }, 'ziina webhook: already processed, skipping');
    return { processed: false };
  }

  await processZiinaEvent(event.type, event.data);
  return { processed: true };
}

/** Zod-parsed defensively, not assumed complete — same "code defensively"
 *  guidance `docs/ziina-integration-notes.md` §6 gives for this payload. */
const ZiinaPaymentIntentEventData = z.object({ id: z.string(), status: z.string() }).passthrough();

async function processZiinaEvent(type: string, data: unknown): Promise<void> {
  if (type !== 'payment_intent.status.updated') {
    logger.info({ type }, 'ziina webhook: no handler for this event type, ignored');
    return;
  }

  const parsed = ZiinaPaymentIntentEventData.safeParse(data);
  if (!parsed.success) {
    logger.warn({ type }, 'ziina webhook: payload missing expected payment intent id/status, skipping');
    return;
  }
  const { id, status } = parsed.data;

  // docs §5's status mapping, narrowed to the two outcomes
  // `recordCardPaymentResult` actually knows how to record. `pending` /
  // `requires_user_action` / `requires_payment_instrument` are
  // intermediate states — the order stays `pending_payment`, nothing to
  // record yet, and Ziina will deliver a later webhook once the intent
  // reaches a terminal state.
  let result: 'succeeded' | 'failed' | null;
  if (status === 'completed') result = 'succeeded';
  else if (status === 'failed' || status === 'canceled') result = 'failed';
  else result = null;

  if (!result) {
    logger.info({ intentId: id, status }, 'ziina webhook: intermediate status, no order transition yet');
    return;
  }

  const order = await orderService.recordCardPaymentResult(id, result);
  if (!order) {
    logger.warn({ intentId: id, type }, 'ziina webhook: no order found for this payment intent');
  }
}
