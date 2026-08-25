import { Router } from 'express';
import * as controller from './pricing.controller.js';
import { requirePricingRead, requirePricingWrite } from './pricing.policy.js';

/**
 * HTTP wiring only (plan.md §5.4). Mounted at `API_PREFIX` by `app.ts`, so
 * routes below resolve to `/api/v1/admin/discounts*` (plan.md §9.7). No
 * public routes — the storefront never calls `pricing` directly; `cart`
 * calls its exported service function server-side (plan.md §5.3).
 */
export function createPricingRouter(): Router {
  const router = Router();

  router.get('/admin/discounts', ...requirePricingRead(), controller.adminList);
  router.post('/admin/discounts', ...requirePricingWrite(), controller.adminCreate);
  router.get('/admin/discounts/:id', ...requirePricingRead(), controller.adminGet);
  router.patch('/admin/discounts/:id', ...requirePricingWrite(), controller.adminUpdate);
  router.delete('/admin/discounts/:id', ...requirePricingWrite(), controller.adminDelete);
  router.post('/admin/discounts/:id/toggle', ...requirePricingWrite(), controller.adminToggle);

  return router;
}
