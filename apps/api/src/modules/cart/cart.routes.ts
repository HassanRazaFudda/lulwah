import { Router } from 'express';
import { createCartController } from './cart.controller.js';
import type { ReservationStore } from './reservation-store.js';
import { requireLoggedIn } from './cart.policy.js';

export interface CartRouterDeps {
  reservationStore: ReservationStore;
}

/**
 * HTTP wiring only (plan.md §5.4). Mounted at `API_PREFIX` by `app.ts`, so
 * routes below resolve to `/api/v1/cart*` (plan.md §9.5). Every route is
 * public except `merge` — a cart exists without a login (plan.md §8.5).
 */
export function createCartRouter({ reservationStore }: CartRouterDeps): Router {
  const router = Router();
  const controller = createCartController({ reservationStore });

  router.post('/cart', controller.create);
  router.get('/cart/:cartId', controller.get);
  router.post('/cart/:cartId/items', controller.addItem);
  router.patch('/cart/:cartId/items/:itemId', controller.updateItem);
  router.delete('/cart/:cartId/items/:itemId', controller.removeItem);
  router.post('/cart/:cartId/coupon', controller.applyCoupon);
  router.delete('/cart/:cartId/coupon', controller.removeCoupon);
  router.post('/cart/:cartId/merge', ...requireLoggedIn(), controller.merge);

  return router;
}
