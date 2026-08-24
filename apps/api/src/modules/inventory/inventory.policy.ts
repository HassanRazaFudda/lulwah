import { requireAuth, requirePermission } from '../identity/identity.policy.js';

/**
 * Permission rules for `inventory` — plan.md §10.2's `Inventory` column.
 * Same composition pattern as `catalog.policy.ts`: `identity` owns RBAC and
 * already declares `inventory.read`/`inventory.write` in its `PERMISSIONS`
 * list, so this module only wires them to its own routes.
 */
export const requireInventoryRead = () => [requireAuth(), requirePermission('inventory.read')] as const;
export const requireInventoryWrite = () => [requireAuth(), requirePermission('inventory.write')] as const;
