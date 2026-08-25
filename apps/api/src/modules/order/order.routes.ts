import { Router } from 'express';
import { ORDER_TRACK_RATE_LIMIT } from '../../config/constants.js';
import { createRateLimiter } from '../../shared/rate-limit.js';
import type { RateLimitStore } from '../../shared/rate-limit.js';
import { requireAuth } from '../identity/identity.policy.js';
import * as controller from './order.controller.js';
import { requireOrderRead, requireOrderStatusUpdate } from './order.policy.js';

export interface OrderRouterDeps {
  rateLimitStore: RateLimitStore;
}

/**
 * HTTP wiring only (plan.md §5.4). Mounted at `API_PREFIX` by `app.ts`, so
 * routes below resolve to `/api/v1/admin/orders*`, `/api/v1/me/orders*`,
 * and `/api/v1/orders/track` (plan.md §9.7, §8.7.5).
 */
export function createOrderRouter({ rateLimitStore }: OrderRouterDeps): Router {
  const router = Router();
  const trackLimiter = createRateLimiter(rateLimitStore, { ...ORDER_TRACK_RATE_LIMIT, keyPrefix: 'order-track' });

  // --- admin — plan.md §9.7 ---------------------------------------------------
  router.get('/admin/orders', ...requireOrderRead(), controller.adminList);
  router.get('/admin/orders/:id', ...requireOrderRead(), controller.adminGet);
  router.patch('/admin/orders/:id/status', ...requireOrderStatusUpdate(), controller.adminUpdateStatus);
  router.post('/admin/orders/:id/notes', ...requireOrderStatusUpdate(), controller.adminAddNote);

  // --- customer-facing — plan.md §9.5/§8.7.5 ----------------------------------
  router.get('/me/orders', requireAuth(), controller.meList);
  router.get('/me/orders/:orderNumber', requireAuth(), controller.meGetByNumber);

  // Guest tracking — no login, rate-limited (plan.md §8.7.5).
  router.get('/orders/track', trackLimiter, controller.track);

  return router;
}
