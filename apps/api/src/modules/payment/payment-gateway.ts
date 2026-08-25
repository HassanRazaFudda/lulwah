import type { PaymentMethod } from '@lulwah/contracts';

/**
 * `PaymentGateway` — plan.md §20: "provider-agnostic... `createIntent`,
 * `capture`, `refund`, `verifyWebhook`." Every concrete gateway
 * (`CodGateway`, `StripeGateway`) implements this one interface;
 * `payment.service.ts` is the only place that picks which one to use for a
 * given `PaymentMethod` — nothing else in the codebase imports a concrete
 * gateway class directly.
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
  /** Stripe's client-side confirmation secret — `null` for gateways with no
   *  such concept (COD). */
  clientSecret: string | null;
  status: IntentStatus;
}

export interface CaptureParams {
  intentId: string;
  /** Partial capture amount; omit to capture the full authorized amount. */
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
  capture(params: CaptureParams): Promise<CaptureResult>;
  refund(params: RefundParams): Promise<RefundResult>;
  /** Synchronous by design — Stripe's own SDK verification (`stripe.webhooks
   *  .constructEvent`) is sync (HMAC over the raw body), and there is no
   *  legitimate reason a signature check should ever need I/O. */
  verifyWebhook(params: VerifyWebhookParams): VerifyWebhookResult;
}
