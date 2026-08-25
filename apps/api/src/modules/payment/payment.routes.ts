import { Router } from 'express';
import * as controller from './payment.controller.js';

/**
 * HTTP wiring only (plan.md §5.4). Mounted at `API_PREFIX` by `app.ts`, so
 * this resolves to `/api/v1/webhooks/stripe` (plan.md §9.6). No RBAC — a
 * webhook has no logged-in actor; `payment.service.ts#handleStripeWebhook`
 * verifies the Stripe signature instead, which is the real trust boundary
 * here. `app.ts` routes this exact path around the global `express.json()`
 * middleware (raw body required for signature verification) — see its own
 * doc comment.
 */
export function createPaymentRouter(): Router {
  const router = Router();
  router.post('/webhooks/stripe', controller.stripeWebhook);
  return router;
}
