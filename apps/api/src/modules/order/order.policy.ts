import { requireAuth, requirePermission } from '../identity/identity.policy.js';

/**
 * Permission rules for `order` — plan.md §10.2's `Orders` column.
 * `orders.read`/`orders.status.update` already exist in `identity.policy
 * .ts`'s `PERMISSIONS` list (declared ahead of time for exactly this
 * module, per that file's own comment) — this module only composes them
 * for its own admin routes, same pattern as `catalog.policy.ts`/`pricing
 * .policy.ts`. The state-machine restriction itself (which transitions a
 * non-`super_admin` role may make) lives in `order.transitions.ts`, not
 * here — this is only the coarse "may this actor attempt a status update
 * at all" gate.
 */
export const requireOrderRead = () => [requireAuth(), requirePermission('orders.read')] as const;
export const requireOrderStatusUpdate = () => [requireAuth(), requirePermission('orders.status.update')] as const;
