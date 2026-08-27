import { requireAuth, requirePermission } from '../identity/identity.policy.js';

/**
 * Permission rules for `customer` — plan.md §10.2's `Customers` column.
 * `customers.read`/`customers.write` already exist in `identity.policy.ts`'s
 * `PERMISSIONS` list (declared ahead of time for exactly this module, per
 * that file's own comment) — this module only composes them for its own
 * routes, same pattern as `catalog.policy.ts`/`order.policy.ts`.
 */
export const requireCustomerRead = () => [requireAuth(), requirePermission('customers.read')] as const;
export const requireCustomerWrite = () => [requireAuth(), requirePermission('customers.write')] as const;
