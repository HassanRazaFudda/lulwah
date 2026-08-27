import { requireAuth, requirePermission } from '../identity/identity.policy.js';

/**
 * Permission rules for `content` — plan.md §10.2's `Content` column.
 * Same composition pattern as `catalog.policy.ts`/`inventory.policy.ts`:
 * `identity` already declares `content.read`/`content.write` in its
 * `PERMISSIONS` list (and grants them to `manager`/`catalog`/`content`
 * roles), so this module only wires them to its own routes.
 */
export const requireContentRead = () => [requireAuth(), requirePermission('content.read')] as const;
export const requireContentWrite = () => [requireAuth(), requirePermission('content.write')] as const;
