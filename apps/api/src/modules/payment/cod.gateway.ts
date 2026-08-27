import { createHash, randomInt, randomUUID } from 'node:crypto';
import { AppError } from '../../shared/errors.js';
import { notifyStub } from '../../shared/notify.js';
import { COD_OTP_LENGTH, COD_OTP_MAX_ATTEMPTS, COD_OTP_TTL_MS } from '../../config/constants.js';
import * as repo from './cod-otp.repository.js';
import type { CaptureParams, CaptureResult, CreateIntentParams, CreateIntentResult, PaymentGateway, RefundParams, RefundResult, VerifyWebhookParams, VerifyWebhookResult } from './payment-gateway.js';

/**
 * `CodGateway` — plan.md §20's `PaymentGateway` interface applied to
 * cash-on-delivery: no external API, fully real and testable end to end.
 * "Payment" for COD is the 6-digit OTP challenge (proves the customer
 * actually owns the phone number placing the order) plus the fee/cap rules
 * `checkout.service.ts` enforces before ever calling this — the money
 * itself is collected in cash at the door, which `order`'s `order.delivered`
 * listener records (`paymentStatus → 'paid'`), not this gateway.
 */

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** A zero-padded `COD_OTP_LENGTH`-digit code, drawn from a CSPRNG
 *  (`node:crypto`'s `randomInt`, not `Math.random()`) — plan.md §10.1's OTP
 *  pattern, applied here. */
function generateOtpCode(): string {
  const max = 10 ** COD_OTP_LENGTH;
  return String(randomInt(0, max)).padStart(COD_OTP_LENGTH, '0');
}

export interface VerifyOtpResult {
  verified: boolean;
  reason?: 'not_requested' | 'expired' | 'too_many_attempts' | 'invalid';
}

export class CodGateway implements PaymentGateway {
  /** `createIntent` for COD *is* `requestOtp` — plan.md §20 asks every
   *  gateway to implement the one shared interface; `requestOtp`/`verifyOtp`
   *  below are COD-specific and called directly by `payment.service.ts`
   *  (and, through it, `checkout`'s `/checkout/cod/verify-otp` route) rather
   *  than through the generic interface, since OTP verification has no
   *  equivalent in `ZiinaGateway`. */
  async createIntent(params: CreateIntentParams): Promise<CreateIntentResult> {
    if (!params.customerPhone) {
      throw new AppError('VALIDATION_FAILED', 400, { messageEn: 'A phone number is required for cash on delivery.', field: 'phone' });
    }
    const { intentId } = await this.requestOtp(params.reference, params.customerPhone);
    return { intentId, redirectUrl: null, status: 'requires_action' };
  }

  /** No real capture step exists for COD (see this class's doc comment) —
   *  reports the intent as already "succeeded" so callers that generically
   *  poll gateway status after `createIntent` don't need a COD-specific
   *  branch. The actual money-collected moment is `order`'s `delivered`
   *  transition. */
  async capture(params: CaptureParams): Promise<CaptureResult> {
    return Promise.resolve({ intentId: params.intentId, status: 'succeeded', capturedFils: params.amountFils ?? 0 });
  }

  /** No online charge exists to reverse for an undelivered COD order — this
   *  is a logged no-op standing in for "credit note issued," relevant only
   *  to the P5 returns workflow this build doesn't implement. */
  async refund(params: RefundParams): Promise<RefundResult> {
    notifyStub({ channel: 'sms', to: 'internal', template: 'cod-refund-noop', data: { intentId: params.intentId, amountFils: params.amountFils } });
    return Promise.resolve({ refundId: `cod_refund_${randomUUID()}`, status: 'succeeded', amountFils: params.amountFils });
  }

  verifyWebhook(_params: VerifyWebhookParams): VerifyWebhookResult {
    throw new AppError('SERVICE_UNAVAILABLE', 503, { messageEn: 'Cash on delivery has no webhooks.' });
  }

  /** Generates a fresh OTP (hashed, never stored in cleartext — see
   *  `cod-otp.model.ts`), 10-minute TTL, and "sends" it via the shared
   *  logged-stub notifier (plan.md §22 — no Unifonic/SMS provider is
   *  configured for this project). The stub log line includes the raw
   *  code: with no real SMS delivery, the log *is* the only channel this
   *  environment has to receive it, which is what makes the COD flow
   *  live-verifiable end to end at all (per the brief) — a real production
   *  build would never log an OTP in cleartext once a real provider exists. */
  async requestOtp(checkoutSessionId: string, phone: string): Promise<{ intentId: string }> {
    const code = generateOtpCode();
    const doc = await repo.createOtp({ checkoutSessionId, phone, codeHash: sha256Hex(code), expiresAt: new Date(Date.now() + COD_OTP_TTL_MS) });
    notifyStub({ channel: 'sms', to: phone, template: 'cod-otp', data: { code, expiresInMinutes: COD_OTP_TTL_MS / 60_000 } });
    return { intentId: doc._id.toString() };
  }

  /** Verifies against the most recently issued OTP for this session.
   *  3-attempt cap and 10-minute TTL enforced here, not just documented —
   *  every wrong guess still counts against the cap even on an otherwise-
   *  correct-format code. */
  async verifyOtp(checkoutSessionId: string, code: string): Promise<VerifyOtpResult> {
    const otp = await repo.findLatestOtp(checkoutSessionId);
    if (!otp) return { verified: false, reason: 'not_requested' };
    if (otp.verifiedAt) return { verified: true };
    if (otp.expiresAt.getTime() < Date.now()) return { verified: false, reason: 'expired' };
    if (otp.attempts >= COD_OTP_MAX_ATTEMPTS) return { verified: false, reason: 'too_many_attempts' };

    await repo.incrementAttempts(otp._id.toString());
    if (sha256Hex(code) !== otp.codeHash) return { verified: false, reason: 'invalid' };

    await repo.markVerified(otp._id.toString());
    return { verified: true };
  }
}
