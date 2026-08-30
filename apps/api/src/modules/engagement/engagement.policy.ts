import { requireAuth, requirePermission } from '../identity/identity.policy.js';

/**
 * Permission rules for `engagement` — see `identity.policy.ts`'s
 * `PERMISSIONS`/`ROLE_PERMISSIONS` for the source of truth. `reviews.read`/
 * `reviews.write` are new (this module's own moderation surface); granted
 * to exactly the roles that already hold `content.read`/`content.write`
 * (`manager`, `catalog`, `content`, plus `super_admin` via
 * `ALL_PERMISSIONS`) — reviews moderation is the same kind of
 * merchandising-adjacent work as content management in this system, so it
 * reuses that same role set rather than inventing a new one.
 *
 * `requireCustomersRead` composes the already-existing `customers.read`
 * (no new permission) for the one engagement route that reads a specific
 * customer's data (`GET /admin/customers/:id/wishlist`) — same composition
 * pattern `cart.policy.ts`/`content.policy.ts` already use for reusing an
 * `identity`-owned permission rather than redeclaring it.
 */
export const requireReviewsRead = () => [requireAuth(), requirePermission('reviews.read')] as const;
export const requireReviewsWrite = () => [requireAuth(), requirePermission('reviews.write')] as const;
export const requireCustomersRead = () => [requireAuth(), requirePermission('customers.read')] as const;

/** `POST /me/reviews` — plan.md §9.4: "authenticated customer only" (the
 *  brief's own wording, no guest review path). */
export const requireLoggedIn = () => [requireAuth()] as const;
