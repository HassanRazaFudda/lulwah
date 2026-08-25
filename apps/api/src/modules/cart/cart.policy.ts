import { requireAuth } from '../identity/identity.policy.js';

/**
 * Access rules for `cart` — plan.md §8.5: a cart exists without a login
 * (guest, identified by the `lulwah_cart` cookie/`cartId`), so every route
 * except merge-on-login is public. `POST /cart/:cartId/merge` requires a
 * just-authenticated user (plan.md §9.5: "after login") — `identity` owns
 * `requireAuth()`; this module only reuses it for the one route that needs
 * it, same composition pattern `catalog.policy.ts`/`inventory.policy.ts`
 * use for RBAC permissions.
 */
export const requireLoggedIn = () => [requireAuth()] as const;
