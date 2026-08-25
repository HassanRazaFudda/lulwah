import Stripe from 'stripe';
import { AppError } from '../../shared/errors.js';
import type { CaptureParams, CaptureResult, CreateIntentParams, CreateIntentResult, IntentStatus, PaymentGateway, RefundParams, RefundResult, VerifyWebhookParams, VerifyWebhookResult } from './payment-gateway.js';

/**
 * `StripeGateway` — plan.md §20's `PaymentGateway` interface against the
 * real `stripe` npm package. **Not live-verified against Stripe's actual
 * API** — no real (even test-mode) Stripe account is configured for this
 * project (`env.STRIPE_SECRET_KEY` is `.optional()` in `env.ts` for exactly
 * this reason). This class is correct per the SDK's own TypeScript types
 * and this module's unit tests (which inject a mocked `Stripe` client, see
 * `__tests__/stripe.gateway.test.ts`), not verified against a live or
 * even sandboxed Stripe endpoint. Say so precisely in any report of this
 * work — "code-complete" and "actually-called-their-API" are different
 * claims.
 *
 * AED's smallest unit is fils (1/100 of a dirham) — the same integer this
 * codebase already stores everywhere as `*Fils` (plan.md §8.1). Stripe's
 * `amount` parameter wants "the smallest currency unit," so `amountFils`
 * passes straight through with no conversion.
 */
export class StripeGateway implements PaymentGateway {
  private readonly client: Stripe;
  private readonly webhookSecret: string;

  /** `client` is injectable for tests — construct a real `Stripe` instance
   *  in `payment.service.ts`'s live wiring, a hand-rolled fake in unit
   *  tests, never a real network call from a test. */
  constructor(secretKey: string, webhookSecret: string, client?: Stripe) {
    this.webhookSecret = webhookSecret;
    this.client = client ?? new Stripe(secretKey);
  }

  async createIntent(params: CreateIntentParams): Promise<CreateIntentResult> {
    const intent = await this.client.paymentIntents.create({
      amount: params.amountFils,
      currency: 'aed',
      metadata: { reference: params.reference, ...(params.metadata ?? {}) },
      ...(params.customerEmail ? { receipt_email: params.customerEmail } : {}),
      automatic_payment_methods: { enabled: true },
    });
    return { intentId: intent.id, clientSecret: intent.client_secret, status: mapIntentStatus(intent.status) };
  }

  async capture(params: CaptureParams): Promise<CaptureResult> {
    const intent = await this.client.paymentIntents.capture(params.intentId, params.amountFils !== undefined ? { amount_to_capture: params.amountFils } : {});
    return { intentId: intent.id, status: mapIntentStatus(intent.status), capturedFils: intent.amount_received };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const refund = await this.client.refunds.create({
      payment_intent: params.intentId,
      amount: params.amountFils,
      ...(params.reason ? { reason: mapRefundReason(params.reason) } : {}),
    });
    return { refundId: refund.id, status: refund.status ?? 'unknown', amountFils: refund.amount };
  }

  /** Sync (see `PaymentGateway`'s doc comment) — Stripe's own SDK
   *  verification is an HMAC over the raw body, no I/O. Throws
   *  `PAYMENT_FAILED` on a bad/missing signature; `payment.controller.ts`'s
   *  webhook handler is what turns that into the right HTTP status. */
  verifyWebhook(params: VerifyWebhookParams): VerifyWebhookResult {
    if (!params.signatureHeader) {
      throw new AppError('PAYMENT_FAILED', 400, { messageEn: 'Missing Stripe signature header.' });
    }
    try {
      const event = this.client.webhooks.constructEvent(params.rawBody, params.signatureHeader, this.webhookSecret);
      return { eventId: event.id, type: event.type, data: event.data.object };
    } catch (err) {
      throw new AppError('PAYMENT_FAILED', 400, { messageEn: 'Invalid Stripe webhook signature.', cause: err });
    }
  }
}

function mapIntentStatus(status: Stripe.PaymentIntent.Status): IntentStatus {
  switch (status) {
    case 'succeeded':
      return 'succeeded';
    case 'requires_capture':
      return 'requires_capture';
    case 'requires_confirmation':
      return 'requires_confirmation';
    case 'requires_action':
      return 'requires_action';
    case 'processing':
      return 'processing';
    case 'canceled':
    case 'requires_payment_method':
    default:
      return 'failed';
  }
}

function mapRefundReason(reason: string): Stripe.RefundCreateParams.Reason {
  if (reason === 'duplicate' || reason === 'fraudulent' || reason === 'requested_by_customer') return reason;
  return 'requested_by_customer';
}
