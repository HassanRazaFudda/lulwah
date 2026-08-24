import { requireAuth, requirePermission } from '../identity/identity.policy.js';

/**
 * Permission rules for `catalog` — plan.md §10.2's `products` column.
 * `identity` owns RBAC (`requireAuth`/`requirePermission`, the
 * `products.read`/`products.write` permission strings and which roles
 * hold them); this module only composes them for its own routes, per the
 * brief's "reuse `requirePermission()`, extend the permission set" —
 * `products.*` already exists in `identity.policy.ts`'s `PERMISSIONS`
 * list, so nothing new needs adding there.
 */
export const requireCatalogRead = () => [requireAuth(), requirePermission('products.read')] as const;
export const requireCatalogWrite = () => [requireAuth(), requirePermission('products.write')] as const;
