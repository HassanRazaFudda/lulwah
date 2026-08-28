import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/errors.js';
import { ZiinaGateway, mapZiinaStatus } from '../ziina.gateway.js';

/**
 * Unit coverage for `ZiinaGateway` — against a mocked `fetch`, never a real
 * network call. **This proves the class is correct per this file's own
 * request/response mapping and Ziina's documented contract
 * (`docs/ziina-integration-notes.md`) — it does NOT prove anything about
 * Ziina's actual API**, since no real (even test-mode) key is configured
 * for this project (no self-serve sandbox exists — see `ziina.gateway.ts`'s
 * own doc comment). Same honest distinction the old `stripe.gateway.test.ts`
 * drew for Stripe.
 */

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

function makeMockFetch(response: Response): typeof fetch {
  return vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

describe('ZiinaGateway', () => {
  describe('createIntent', () => {
    it('passes amountFils straight through as the "base currency units" amount (no conversion), and returns redirectUrl (not a client secret)', async () => {
      const fetchImpl = makeMockFetch(
        jsonResponse({ id: 'pi_123', status: 'requires_payment_instrument', amount: 24_900, redirect_url: 'https://pay.ziina.com/pi_123' }),
      );
      const gateway = new ZiinaGateway('key_test_x', 'whsec_x', fetchImpl);

      const result = await gateway.createIntent({ reference: 'checkout-session-1', amountFils: 24_900, currency: 'AED', method: 'card', customerEmail: 'shopper@example.com', customerPhone: null, successUrl: null, cancelUrl: null, failureUrl: null });

      expect(fetchImpl).toHaveBeenCalledWith(
        'https://api-v2.ziina.com/api/payment_intent',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer key_test_x' }),
          body: expect.stringContaining('"amount":24900'),
        }),
      );
      expect(JSON.parse((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)).toMatchObject({ amount: 24_900, currency_code: 'AED' });
      expect(result).toEqual({ intentId: 'pi_123', redirectUrl: 'https://pay.ziina.com/pi_123', status: 'requires_action' });
    });

    it('maps every documented Ziina payment-intent status to the gateway-neutral IntentStatus', async () => {
      const cases: Array<[string, string]> = [
        ['completed', 'succeeded'],
        ['pending', 'processing'],
        ['requires_payment_instrument', 'requires_action'],
        ['requires_user_action', 'requires_action'],
        ['failed', 'failed'],
        ['canceled', 'failed'],
      ];
      for (const [ziinaStatus, expected] of cases) {
        const fetchImpl = makeMockFetch(jsonResponse({ id: 'pi_x', status: ziinaStatus, redirect_url: null }));
        const gateway = new ZiinaGateway('key_test_x', 'whsec_x', fetchImpl);
        const result = await gateway.createIntent({ reference: 'ref', amountFils: 1000, currency: 'AED', method: 'card', customerEmail: null, customerPhone: null, successUrl: null, cancelUrl: null, failureUrl: null });
        expect(result.status).toBe(expected);
      }
    });

    it('throws PAYMENT_FAILED when Ziina responds with a non-2xx status', async () => {
      const fetchImpl = makeMockFetch(jsonResponse({ message: 'invalid key' }, false, 401));
      const gateway = new ZiinaGateway('bad_key', 'whsec_x', fetchImpl);
      await expect(gateway.createIntent({ reference: 'ref', amountFils: 1000, currency: 'AED', method: 'card', customerEmail: null, customerPhone: null, successUrl: null, cancelUrl: null, failureUrl: null })).rejects.toThrow(AppError);
    });

    it('includes success_url/cancel_url/failure_url in the request body when given (docs §3 — all three documented-optional)', async () => {
      const fetchImpl = makeMockFetch(jsonResponse({ id: 'pi_urls', status: 'requires_payment_instrument', redirect_url: 'https://pay.ziina.com/pi_urls' }));
      const gateway = new ZiinaGateway('key_test_x', 'whsec_x', fetchImpl);

      await gateway.createIntent({
        reference: 'checkout-session-2',
        amountFils: 10_000,
        currency: 'AED',
        method: 'card',
        customerEmail: null,
        customerPhone: null,
        successUrl: 'https://lulwahfashion.com/en/checkout/session/sess-1/return?result=success',
        cancelUrl: 'https://lulwahfashion.com/en/checkout/session/sess-1/return?result=cancel',
        failureUrl: 'https://lulwahfashion.com/en/checkout/session/sess-1/return?result=failure',
      });

      const sentBody = JSON.parse((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
      expect(sentBody).toMatchObject({
        success_url: 'https://lulwahfashion.com/en/checkout/session/sess-1/return?result=success',
        cancel_url: 'https://lulwahfashion.com/en/checkout/session/sess-1/return?result=cancel',
        failure_url: 'https://lulwahfashion.com/en/checkout/session/sess-1/return?result=failure',
      });
    });

    it('omits success_url/cancel_url/failure_url entirely (not sent as literal null) when not given', async () => {
      const fetchImpl = makeMockFetch(jsonResponse({ id: 'pi_no_urls', status: 'requires_payment_instrument', redirect_url: 'https://pay.ziina.com/pi_no_urls' }));
      const gateway = new ZiinaGateway('key_test_x', 'whsec_x', fetchImpl);

      await gateway.createIntent({ reference: 'checkout-session-3', amountFils: 10_000, currency: 'AED', method: 'card', customerEmail: null, customerPhone: null, successUrl: null, cancelUrl: null, failureUrl: null });

      const sentBody = JSON.parse((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
      expect(sentBody).not.toHaveProperty('success_url');
      expect(sentBody).not.toHaveProperty('cancel_url');
      expect(sentBody).not.toHaveProperty('failure_url');
    });
  });

  describe('capture — status-passthrough, not a real capture (Ziina has no capture step)', () => {
    it('GETs the intent and reports its current status/amount rather than mutating anything', async () => {
      const fetchImpl = makeMockFetch(jsonResponse({ id: 'pi_123', status: 'completed', amount: 15_000, redirect_url: null }));
      const gateway = new ZiinaGateway('key_test_x', 'whsec_x', fetchImpl);

      const result = await gateway.capture({ intentId: 'pi_123' });
      expect(fetchImpl).toHaveBeenCalledWith('https://api-v2.ziina.com/api/payment_intent/pi_123', expect.objectContaining({ method: 'GET' }));
      expect(result).toEqual({ intentId: 'pi_123', status: 'succeeded', capturedFils: 15_000 });
    });
  });

  describe('refund', () => {
    it('sends the resolved amount and payment_intent_id, and returns the gateway-neutral RefundResult', async () => {
      const fetchImpl = makeMockFetch(jsonResponse({ id: 're_1', payment_intent_id: 'pi_123', amount: 5_000, status: 'pending' }));
      const gateway = new ZiinaGateway('key_test_x', 'whsec_x', fetchImpl);

      const result = await gateway.refund({ intentId: 'pi_123', amountFils: 5_000, reason: 'requested_by_customer' });
      const sentBody = JSON.parse((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
      expect(sentBody).toMatchObject({ payment_intent_id: 'pi_123', amount: 5_000 });
      expect(typeof sentBody.id).toBe('string'); // client-generated UUID, per docs §7
      expect(result).toEqual({ refundId: 're_1', status: 'pending', amountFils: 5_000 });
    });
  });

  describe('verifyWebhook', () => {
    const secret = 'whsec_test_secret';
    function sign(rawBody: string): string {
      return createHmac('sha256', secret).update(rawBody).digest('hex');
    }

    it('returns the parsed event on a valid signature, with a stable dedupe key built from intent id + status', () => {
      const rawBody = JSON.stringify({ event: 'payment_intent.status.updated', data: { id: 'pi_123', status: 'completed', amount: 24_900 } });
      const gateway = new ZiinaGateway('key_test_x', secret);

      const result = gateway.verifyWebhook({ rawBody, signatureHeader: sign(rawBody) });
      expect(result).toEqual({ eventId: 'pi_123:completed', type: 'payment_intent.status.updated', data: { id: 'pi_123', status: 'completed', amount: 24_900 } });
    });

    it('accepts a Buffer rawBody identically to a string one (the real webhook path gets a Buffer from express.raw())', () => {
      const rawBody = JSON.stringify({ event: 'payment_intent.status.updated', data: { id: 'pi_456', status: 'failed' } });
      const gateway = new ZiinaGateway('key_test_x', secret);

      const result = gateway.verifyWebhook({ rawBody: Buffer.from(rawBody, 'utf8'), signatureHeader: sign(rawBody) });
      expect(result.eventId).toBe('pi_456:failed');
    });

    it('throws PAYMENT_FAILED when the signature header is missing', () => {
      const gateway = new ZiinaGateway('key_test_x', secret);
      expect(() => gateway.verifyWebhook({ rawBody: '{}', signatureHeader: undefined })).toThrow(AppError);
      try {
        gateway.verifyWebhook({ rawBody: '{}', signatureHeader: undefined });
      } catch (err) {
        expect((err as AppError).code).toBe('PAYMENT_FAILED');
        expect((err as AppError).httpStatus).toBe(400);
      }
    });

    it('throws PAYMENT_FAILED when the signature does not match (uses timingSafeEqual, not ===, but the outcome is the same either way)', () => {
      const rawBody = JSON.stringify({ event: 'payment_intent.status.updated', data: { id: 'pi_123', status: 'completed' } });
      const gateway = new ZiinaGateway('key_test_x', secret);
      expect(() => gateway.verifyWebhook({ rawBody, signatureHeader: 'a'.repeat(64) })).toThrow(AppError);
    });

    it('throws PAYMENT_FAILED when the signature is a different length than a real HMAC-SHA256 hex digest (would otherwise crash timingSafeEqual with a RangeError)', () => {
      const rawBody = JSON.stringify({ event: 'payment_intent.status.updated', data: { id: 'pi_123', status: 'completed' } });
      const gateway = new ZiinaGateway('key_test_x', secret);
      expect(() => gateway.verifyWebhook({ rawBody, signatureHeader: 'short' })).toThrow(AppError);
    });

    it('throws PAYMENT_FAILED for a validly-signed but malformed payload (not the documented {event, data} shape)', () => {
      const rawBody = JSON.stringify({ unexpected: true });
      const gateway = new ZiinaGateway('key_test_x', secret);
      expect(() => gateway.verifyWebhook({ rawBody, signatureHeader: sign(rawBody) })).toThrow(AppError);
    });
  });

  describe('mapZiinaStatus', () => {
    it('is exported standalone for reuse outside the class', () => {
      expect(mapZiinaStatus('completed')).toBe('succeeded');
      expect(mapZiinaStatus('failed')).toBe('failed');
    });
  });
});
