import { Router } from 'express';
import { createCheckoutController } from './checkout.controller.js';
import type { IdempotencyStore } from './idempotency-store.js';
import type { ReservationStore } from '../cart/reservation-store.js';
import { attachUserIfPresent } from '../identity/identity.policy.js';

export interface CheckoutRouterDeps {
  reservationStore: ReservationStore;
  idempotencyStore: IdempotencyStore;
}

/**
 * HTTP wiring only (plan.md §5.4). Mounted at `API_PREFIX` by `app.ts`, so
 * routes below resolve to `/api/v1/checkout*` (plan.md §9.5). Every route
 * is public — checkout supports guest checkout throughout (plan.md §15.6:
 * "no forced account creation"); `attachUserIfPresent()` (never
 * `requireAuth()`) runs ahead of every route below so `checkout.service.ts`
 * can read `req.user` when present to attach a logged-in customer's
 * identity, without ever gating the flow behind login. (Found and fixed as
 * part of P3: this middleware previously didn't exist at all, so `req.user`
 * was always `undefined` here — a logged-in customer's checkout never
 * actually got linked to their account despite the code already being
 * written to expect it.)
 */
export function createCheckoutRouter({ reservationStore, idempotencyStore }: CheckoutRouterDeps): Router {
  const router = Router();
  const controller = createCheckoutController({ reservationStore, idempotencyStore });

  router.use(attachUserIfPresent());

  router.post('/checkout/session', controller.create);
  router.get('/checkout/session/:id', controller.get);
  router.post('/checkout/session/:id/address', controller.setAddress);
  router.post('/checkout/session/:id/shipping', controller.setShipping);
  router.post('/checkout/session/:id/payment-intent', controller.createPaymentIntent);
  router.post('/checkout/session/:id/place', controller.place);
  router.post('/checkout/cod/verify-otp', controller.verifyCodOtp);

  return router;
}
