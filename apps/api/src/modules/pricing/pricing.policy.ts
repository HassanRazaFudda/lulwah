import { requireAuth, requirePermission } from '../identity/identity.policy.js';

/**
 * Permission rules for `pricing` — plan.md §10.2's `Discounts` column.
 * `discounts.read`/`discounts.write` already exist in `identity.policy
 * .ts`'s `PERMISSIONS` list (declared ahead of time for exactly this
 * module, per that file's own comment) — this module only composes them
 * for its own routes, same pattern as `catalog.policy.ts`/`inventory
 * .policy.ts`.
 */
export const requirePricingRead = () => [requireAuth(), requirePermission('discounts.read')] as const;
export const requirePricingWrite = () => [requireAuth(), requirePermission('discounts.write')] as const;
