import { requireAuth, requirePermission } from '../identity/identity.policy.js';

/**
 * Permission rules for `settings` — plan.md §10.2's `Settings` column.
 * `settings.read`/`settings.write` already exist in `identity.policy.ts`'s
 * `PERMISSIONS` list (declared ahead of time for exactly this module, per
 * that file's own comment) — this module only composes them for its own
 * routes, same pattern as `pricing.policy.ts`/`catalog.policy.ts`.
 */
export const requireSettingsRead = () => [requireAuth(), requirePermission('settings.read')] as const;
export const requireSettingsWrite = () => [requireAuth(), requirePermission('settings.write')] as const;
