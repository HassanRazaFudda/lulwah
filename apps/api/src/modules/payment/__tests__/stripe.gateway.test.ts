import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { AppError } from '../../../shared/errors.js';
import { StripeGateway } from '../stripe.gateway.js';

/**
 * Unit coverage for `StripeGateway` — against a hand-rolled mock of the
 * `stripe` SDK's client shape, never a real network call. **This proves
 * the class is correct per the SDK's own TypeScript types and this
 * mapping logic — it does NOT prove anything about Stripe's actual API**,
 * since no real (even test-mode) Stripe account is configured for this
 * project. See `stripe.gateway.ts`'s own doc comment.
 */

function makeMockClient(overrides: Partial<{ paymentIntents: Partial<Stripe.PaymentIntentsResource>; refunds: Partial<Stripe.RefundsResource>; webhooks: Partial<Stripe.Webhooks> }> = {}): Stripe {
  return {
    paymentIntents: { create: vi.fn(), capture: vi.fn(), ...overrides.paymentIntents },
    refunds: { create: vi.fn(), ...overrides.refunds },
    webhooks: { constructEvent: vi.fn(), ...overrides.webhooks },
  } as unknown as Stripe;
}

describe('StripeGateway', () => {
  it('createIntent passes amountFils straight through as the smallest-unit amount (no conversion)', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'pi_123', client_secret: 'secret_abc', status: 'requires_payment_method' } satisfies Partial<Stripe.PaymentIntent>);
    const client = makeMockClient({ paymentIntents: { create } });
    const gateway = new StripeGateway('sk_test_x', 'whsec_x', client);

    const result = await gateway.createIntent({ reference: 'checkout-session-1', amountFils: 24_900, currency: 'AED', method: 'card', customerEmail: 'shopper@example.com', customerPhone: null });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 24_900, currency: 'aed', receipt_email: 'shopper@example.com', metadata: expect.objectContaining({ reference: 'checkout-session-1' }) }),
    );
    expect(result).toEqual({ intentId: 'pi_123', clientSecret: 'secret_abc', status: 'failed' }); // requires_payment_method maps to 'failed' — see mapIntentStatus's doc comment
  });

  it('createIntent maps every Stripe PaymentIntent status to the gateway-neutral IntentStatus', async () => {
    const cases: Array<[Stripe.PaymentIntent.Status, string]> = [
      ['succeeded', 'succeeded'],
      ['requires_capture', 'requires_capture'],
      ['requires_confirmation', 'requires_confirmation'],
      ['requires_action', 'requires_action'],
      ['processing', 'processing'],
      ['canceled', 'failed'],
      ['requires_payment_method', 'failed'],
    ];
    for (const [stripeStatus, expected] of cases) {
      const create = vi.fn().mockResolvedValue({ id: 'pi_x', client_secret: null, status: stripeStatus } satisfies Partial<Stripe.PaymentIntent>);
      const gateway = new StripeGateway('sk_test_x', 'whsec_x', makeMockClient({ paymentIntents: { create } }));
      const result = await gateway.createIntent({ reference: 'ref', amountFils: 1000, currency: 'AED', method: 'card', customerEmail: null, customerPhone: null });
      expect(result.status).toBe(expected);
    }
  });

  it('capture forwards a partial-amount request and reports the actually-captured amount', async () => {
    const capture = vi.fn().mockResolvedValue({ id: 'pi_123', status: 'succeeded', amount_received: 15_000 } satisfies Partial<Stripe.PaymentIntent>);
    const gateway = new StripeGateway('sk_test_x', 'whsec_x', makeMockClient({ paymentIntents: { capture } }));

    const result = await gateway.capture({ intentId: 'pi_123', amountFils: 15_000 });
    expect(capture).toHaveBeenCalledWith('pi_123', { amount_to_capture: 15_000 });
    expect(result).toEqual({ intentId: 'pi_123', status: 'succeeded', capturedFils: 15_000 });
  });

  it('refund passes the amount and a valid reason through', async () => {
    const create = vi.fn().mockResolvedValue({ id: 're_1', status: 'succeeded', amount: 5_000 } satisfies Partial<Stripe.Refund>);
    const gateway = new StripeGateway('sk_test_x', 'whsec_x', makeMockClient({ refunds: { create } }));

    const result = await gateway.refund({ intentId: 'pi_123', amountFils: 5_000, reason: 'requested_by_customer' });
    expect(create).toHaveBeenCalledWith({ payment_intent: 'pi_123', amount: 5_000, reason: 'requested_by_customer' });
    expect(result).toEqual({ refundId: 're_1', status: 'succeeded', amountFils: 5_000 });
  });

  it('verifyWebhook returns the parsed event on a valid signature', () => {
    const constructEvent = vi.fn().mockReturnValue({ id: 'evt_1', type: 'payment_intent.succeeded', data: { object: { id: 'pi_123' } } });
    const gateway = new StripeGateway('sk_test_x', 'whsec_x', makeMockClient({ webhooks: { constructEvent } }));

    const result = gateway.verifyWebhook({ rawBody: '{"id":"evt_1"}', signatureHeader: 't=123,v1=abc' });
    expect(result).toEqual({ eventId: 'evt_1', type: 'payment_intent.succeeded', data: { id: 'pi_123' } });
  });

  it('verifyWebhook throws PAYMENT_FAILED when the signature header is missing', () => {
    const gateway = new StripeGateway('sk_test_x', 'whsec_x', makeMockClient());
    expect(() => gateway.verifyWebhook({ rawBody: '{}', signatureHeader: undefined })).toThrow(AppError);
    try {
      gateway.verifyWebhook({ rawBody: '{}', signatureHeader: undefined });
    } catch (err) {
      expect((err as AppError).code).toBe('PAYMENT_FAILED');
      expect((err as AppError).httpStatus).toBe(400);
    }
  });

  it('verifyWebhook throws PAYMENT_FAILED when the SDK rejects the signature', () => {
    const constructEvent = vi.fn().mockImplementation(() => {
      throw new Error('signature mismatch');
    });
    const gateway = new StripeGateway('sk_test_x', 'whsec_x', makeMockClient({ webhooks: { constructEvent } }));
    expect(() => gateway.verifyWebhook({ rawBody: '{}', signatureHeader: 'bad' })).toThrow(AppError);
  });
});
