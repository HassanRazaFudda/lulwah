import { Router } from 'express';
import * as controller from './inventory.controller.js';
import { requireInventoryRead, requireInventoryWrite } from './inventory.policy.js';

/**
 * HTTP wiring only (plan.md §5.4). Mounted at `API_PREFIX` by `app.ts`, so
 * routes below resolve to `/api/v1/admin/inventory*` (plan.md §9.7) — this
 * module has no public routes in this phase (the cart-reservation flow
 * that would expose availability to shoppers directly is P2 scope).
 */
export function createInventoryRouter(): Router {
  const router = Router();

  router.get('/admin/inventory', ...requireInventoryRead(), controller.list);
  router.post('/admin/inventory/:variantId/adjust', ...requireInventoryWrite(), controller.adjust);
  router.get('/admin/inventory/:variantId/movements', ...requireInventoryRead(), controller.listMovements);

  return router;
}
