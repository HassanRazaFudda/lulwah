import { Router } from 'express';
import { attachUserIfPresent } from '../identity/identity.policy.js';
import * as reviewController from './review.controller.js';
import * as wishlistController from './wishlist.controller.js';
import { requireCustomersRead, requireLoggedIn, requireReviewsRead, requireReviewsWrite } from './engagement.policy.js';

/**
 * HTTP wiring only (plan.md §5.4) — path, middleware, handler binding, no
 * logic. Mounted at `API_PREFIX` by `app.ts`, so routes below resolve to
 * `/api/v1/products/:id/reviews`, `/api/v1/me/reviews`,
 * `/api/v1/me/wishlist*` (plan.md §9.2/§9.4) and `/api/v1/admin/reviews*` /
 * `/api/v1/admin/customers/:id/{reviews,wishlist}` (plan.md §11.1's
 * Customer detail screen + this module's own moderation queue, designed
 * following `content.routes.ts`'s public/admin split precedent — nothing
 * in plan.md's own §9 endpoint list names a moderation surface, so this is
 * a deliberate, narrow extension of it, same category as
 * `order.routes.ts`'s `/admin/orders/:id/notes` being added for a need
 * plan.md's own abbreviated route list didn't spell out).
 *
 * `GET|POST /me/wishlist` and `DELETE /me/wishlist/:productId` use
 * `attachUserIfPresent()` (never `requireAuth()`) — plan.md §9.4 lists them
 * as both authenticated AND guest routes, the same public-or-logged-in
 * shape `cart.routes.ts` gives every route except `merge`.
 * `POST /me/reviews` DOES require a real login (the brief's own wording:
 * "authenticated customer only" — no guest review path).
 *
 * Route-ordering note: `/admin/reviews` (list) is registered before its
 * `/admin/reviews/:id/status` and `/admin/reviews/:id/reply` sub-paths —
 * matching `content.routes.ts`'s own documented reason: Express matches in
 * registration order, though here there's no actual literal-vs-`:id`
 * collision risk (`status`/`reply` are suffixes after an id, not siblings
 * of it), so this is just kept in the same conventional order for
 * readability, not because it's load-bearing here.
 */
export function createEngagementRouter(): Router {
  const router = Router();

  // --- public --------------------------------------------------------------
  router.get('/products/:id/reviews', reviewController.getPublicForProduct);

  // --- customer self-service (`/me/*`) --------------------------------------
  router.post('/me/reviews', ...requireLoggedIn(), reviewController.createMy);
  router.get('/me/wishlist', attachUserIfPresent(), wishlistController.getMy);
  router.post('/me/wishlist', attachUserIfPresent(), wishlistController.addItem);
  router.delete('/me/wishlist/:productId', attachUserIfPresent(), wishlistController.removeItem);

  // --- admin: review moderation ----------------------------------------------
  router.get('/admin/reviews', ...requireReviewsRead(), reviewController.adminList);
  router.patch('/admin/reviews/:id/status', ...requireReviewsWrite(), reviewController.adminUpdateStatus);
  router.patch('/admin/reviews/:id/reply', ...requireReviewsWrite(), reviewController.adminReply);

  // --- admin: Customer detail screen composition (plan.md §11.1) -------------
  router.get('/admin/customers/:id/reviews', ...requireReviewsRead(), reviewController.adminListForCustomer);
  router.get('/admin/customers/:id/wishlist', ...requireCustomersRead(), wishlistController.adminGetForCustomer);

  return router;
}
