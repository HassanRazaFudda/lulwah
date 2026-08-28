import { describe, expect, it } from 'vitest';
import { env } from '../../../shared/env.js';
import { buildCheckoutReturnUrls } from '../checkout.service.js';

/**
 * Pure unit coverage for `buildCheckoutReturnUrls` — the Ziina
 * hosted-redirect URL construction (`docs/ziina-integration-notes.md`
 * §1/§3, `checkout.service.ts#createPaymentIntent`). Deliberately NOT
 * routed through the full HTTP/Mongo integration suite
 * (`checkout.integration.test.ts`): `payment.service.ts#createCardIntent`
 * 503s cleanly before ever reaching `ZiinaGateway` in this environment (no
 * `ZIINA_API_KEY` configured — see that suite's own "card payment intent
 * creation 503s cleanly" test), which would make asserting the actual URL
 * values impossible there without either reconfiguring global test env
 * (breaking that 503 test's own assumption) or a brittle per-test
 * module-registry reset. Testing the exported builder directly sidesteps
 * both, per plan.md's "make the real call after checking, don't guess"
 * standard for the locale-prefix question this function's own doc comment
 * answers.
 */
describe('buildCheckoutReturnUrls', () => {
  it('builds locale-prefixed (/en/...) return URLs keyed by the checkout session id, one per Ziina outcome', () => {
    const urls = buildCheckoutReturnUrls('session-abc-123');
    expect(urls).toEqual({
      successUrl: `${env.WEB_URL}/en/checkout/session/session-abc-123/return?result=success`,
      cancelUrl: `${env.WEB_URL}/en/checkout/session/session-abc-123/return?result=cancel`,
      failureUrl: `${env.WEB_URL}/en/checkout/session/session-abc-123/return?result=failure`,
    });
  });

  it('URL-encodes the session id', () => {
    const urls = buildCheckoutReturnUrls('sess/with space');
    expect(urls.successUrl).toBe(`${env.WEB_URL}/en/checkout/session/${encodeURIComponent('sess/with space')}/return?result=success`);
  });

  it('the three URLs differ only by the result query param, never mixed up', () => {
    const urls = buildCheckoutReturnUrls('session-xyz');
    expect(urls.successUrl.replace('result=success', '')).toBe(urls.cancelUrl.replace('result=cancel', ''));
    expect(urls.successUrl.replace('result=success', '')).toBe(urls.failureUrl.replace('result=failure', ''));
  });
});
