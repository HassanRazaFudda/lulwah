import { Router } from 'express';
import { createCheckoutController } from './checkout.controller.js';
import type { IdempotencyStore } from './idempotency-store.js';
import type { ReservationStore } from '../cart/reservation-store.js';

export interface CheckoutRouterDeps {
  reservationStore: ReservationStore;
  idempotencyStore: IdempotencyStore;
}

/**
 * HTTP wiring only (plan.md §5.4). Mounted at `API_PREFIX` by `app.ts`, so
 * routes below resolve to `/api/v1/checkout*` (plan.md §9.5). Every route
 * is public — checkout supports guest checkout throughout (plan.md §15.6:
 * "no forced account creation"); `checkout.service.ts` itself reads
 * `req.user` when present to attach a logged-in customer's identity, never
 * gates the flow behind `requireAuth()`.
 */
export function createCheckoutRouter({ reservationStore, idempotencyStore }: CheckoutRouterDeps): Router {
  const router = Router();
  const controller = createCheckoutController({ reservationStore, idempotencyStore });

  router.post('/checkout/session', controller.create);
  router.get('/checkout/session/:id', controller.get);
  router.post('/checkout/session/:id/address', controller.setAddress);
  router.post('/checkout/session/:id/shipping', controller.setShipping);
  router.post('/checkout/session/:id/payment-intent', controller.createPaymentIntent);
  router.post('/checkout/session/:id/place', controller.place);
  router.post('/checkout/cod/verify-otp', controller.verifyCodOtp);

  return router;
}
