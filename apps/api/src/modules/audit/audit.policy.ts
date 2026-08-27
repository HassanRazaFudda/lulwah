import { requireAuth, requirePermission } from '../identity/identity.policy.js';

/**
 * Permission rule for `audit` — plan.md §11.1. `audit.read` is declared in
 * `identity.policy.ts`'s `PERMISSIONS` list (added alongside this module,
 * same "declared ahead of time, composed here" pattern `order.policy.ts`/
 * `pricing.policy.ts` already use for their own permissions) and granted
 * to `super_admin`/`manager` only — see that file's comment on why the
 * rest of the role matrix deliberately does NOT get it.
 *
 * Read-only module: there is no `audit.write` — nothing ever mutates an
 * audit entry once written (append-only, per `audit.model.ts`).
 */
export const requireAuditRead = () => [requireAuth(), requirePermission('audit.read')] as const;
