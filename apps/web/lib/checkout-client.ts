import type { AddressLabel, Emirate } from '@lulwah/contracts';
import { apiFetch } from './api-client';
import { CheckoutSessionResponse, PaymentIntentResponse, PlaceOrderResponse } from './checkout-schemas';

/**
 * Thin fetch functions over `apiFetch` for the real `checkout` module
 * (`apps/api/src/modules/checkout/checkout.routes.ts`) — session create/
 * read, address, shipping, payment intent, COD OTP verify, and the
 * idempotent `place`. Every route is public (guest checkout throughout,
 * plan.md §15.6), so none of these need an auth header.
 */

export interface InlineAddressInput {
  label?: AddressLabel;
  firstName: string;
  lastName: string;
  phone: { countryCode: '+971'; number: string };
  emirate: Emirate;
  city: string;
  area: string;
  buildingName: string;
  apartment?: string;
  street?: string;
  landmark: string;
  makani?: string | null;
  poBox?: string | null;
}

export async function createCheckoutSession(input: { cartId: string; guestEmail?: string }): Promise<CheckoutSessionResponse> {
  return apiFetch('/checkout/session', CheckoutSessionResponse, { method: 'POST', body: input });
}

export async function getCheckoutSession(sessionId: string): Promise<CheckoutSessionResponse> {
  return apiFetch(`/checkout/session/${encodeURIComponent(sessionId)}`, CheckoutSessionResponse);
}

export async function setCheckoutAddress(sessionId: string, shippingInline: InlineAddressInput): Promise<CheckoutSessionResponse> {
  return apiFetch(`/checkout/session/${encodeURIComponent(sessionId)}/address`, CheckoutSessionResponse, {
    method: 'POST',
    body: { shipping: { inline: shippingInline }, billingSameAsShipping: true },
  });
}

export async function setCheckoutShipping(sessionId: string): Promise<CheckoutSessionResponse> {
  return apiFetch(`/checkout/session/${encodeURIComponent(sessionId)}/shipping`, CheckoutSessionResponse, {
    method: 'POST',
    body: {},
  });
}

export async function createPaymentIntent(sessionId: string, method: 'cod' | 'card'): Promise<PaymentIntentResponse> {
  return apiFetch(`/checkout/session/${encodeURIComponent(sessionId)}/payment-intent`, PaymentIntentResponse, {
    method: 'POST',
    body: { method },
  });
}

export async function verifyCodOtp(sessionId: string, code: string): Promise<CheckoutSessionResponse> {
  return apiFetch('/checkout/cod/verify-otp', CheckoutSessionResponse, {
    method: 'POST',
    body: { sessionId, code },
  });
}

/** plan.md §9.5: "requires an `Idempotency-Key` header." The caller
 *  generates the UUID once per checkout attempt and reuses it across
 *  retries (`checkout/page.tsx`'s own `useMemo`'d key) — a fresh order
 *  attempt (new session) gets a fresh one. */
export async function placeOrder(sessionId: string, idempotencyKey: string, customerNote?: string): Promise<PlaceOrderResponse> {
  return apiFetch(`/checkout/session/${encodeURIComponent(sessionId)}/place`, PlaceOrderResponse, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: customerNote ? { customerNote } : {},
  });
}
