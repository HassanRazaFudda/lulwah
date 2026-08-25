import { env } from '../../shared/env.js';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import * as orderService from '../order/order.service.js';
import { CodGateway } from './cod.gateway.js';
import type { VerifyOtpResult } from './cod.gateway.js';
import { StripeGateway } from './stripe.gateway.js';
import * as webhookRepo from './webhook-event.repository.js';
import type { CreateIntentParams, CreateIntentResult } from './payment-gateway.js';

/**
 * ALL payment orchestration lives here, framework-free (no `express` — plan.md
 * §5.4). Picks the right `PaymentGateway` for a `PaymentMethod`; `checkout
 * .service.ts` and `payment.controller.ts` never construct a concrete
 * gateway class themselves.
 */

const codGateway = new CodGateway();

function stripeGateway(): StripeGateway {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    // No real (even test-mode) Stripe account is configured for this
    // project (see `env.ts`'s doc comment) — this is the one place that
    // becomes visible to a caller, as a clean 503 rather than a crash at
    // `new Stripe(undefined)` deep inside the SDK.
    throw new AppError('SERVICE_UNAVAILABLE', 503, { messageEn: 'Card payments are not configured yet.' });
  }
  return new StripeGateway(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET);
}

// ---------------------------------------------------------------------------
// Card (Stripe)
// ---------------------------------------------------------------------------

export async function createCardIntent(params: Omit<CreateIntentParams, 'method'>): Promise<CreateIntentResult> {
  return stripeGateway().createIntent({ ...params, method: 'card' });
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
// Stripe webhook — plan.md §9.6: verify signature → idempotency check →
// (if unseen) persist + process → 200 within 5s, never blocking on slow
// work. The actual work here (one order lookup, a handful of field writes,
// `order.confirmed`'s already-fast side effects) genuinely is fast enough
// to just do inline, per the brief's own "use your judgement" allowance —
// no separate queue consumer built for this.
// ---------------------------------------------------------------------------

export interface HandleStripeWebhookResult {
  /** `false` when the event had already been processed — the controller
   *  still responds 200 either way (plan.md §9.6), this is only for
   *  logging/tests to tell the two cases apart. */
  processed: boolean;
}

export async function handleStripeWebhook(rawBody: string | Buffer, signatureHeader: string | undefined): Promise<HandleStripeWebhookResult> {
  const event = stripeGateway().verifyWebhook({ rawBody, signatureHeader });

  const claimed = await webhookRepo.tryClaimWebhookEvent('stripe', event.eventId, event.type);
  if (!claimed) {
    logger.info({ eventId: event.eventId, type: event.type }, 'stripe webhook: already processed, skipping');
    return { processed: false };
  }

  await processStripeEvent(event.type, event.data);
  return { processed: true };
}

interface StripePaymentIntentLike {
  id: string;
  latest_charge?: string | { id: string } | null;
}

function isPaymentIntentLike(data: unknown): data is StripePaymentIntentLike {
  return typeof data === 'object' && data !== null && 'id' in data && typeof (data as { id: unknown }).id === 'string';
}

async function processStripeEvent(type: string, data: unknown): Promise<void> {
  if (type === 'payment_intent.succeeded' || type === 'payment_intent.payment_failed') {
    if (!isPaymentIntentLike(data)) {
      logger.warn({ type }, 'stripe webhook: payload missing expected PaymentIntent id, skipping');
      return;
    }
    const chargeId = typeof data.latest_charge === 'string' ? data.latest_charge : data.latest_charge?.id;
    const result = type === 'payment_intent.succeeded' ? 'succeeded' : 'failed';
    const order = await orderService.recordCardPaymentResult(data.id, result, chargeId);
    if (!order) {
      logger.warn({ intentId: data.id, type }, 'stripe webhook: no order found for this PaymentIntent');
    }
    return;
  }
  logger.info({ type }, 'stripe webhook: no handler for this event type, ignored');
}
