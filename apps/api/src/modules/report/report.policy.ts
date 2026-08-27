import { AppError } from '../../shared/errors.js';
import { assertPermission, requireAuth, requirePermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';

/**
 * Permission rules for `report` — plan.md §10.2's `Reports` column.
 * `identity` already declares both `reports.read` and `reports.write` in
 * its `PERMISSIONS` list (its own file's doc comment: declared ahead of
 * time for exactly this module); this module only composes them, same
 * pattern as every other module's `*.policy.ts`.
 *
 * The brief distinguishes "view" (`reports.read`) from "export"
 * (`reports.write`, if distinguished at all) — every report GET route
 * only requires `reports.read`; a `?format=csv` download additionally
 * requires `reports.write`, re-checked in the controller (plan.md §10.2:
 * "re-checked in the service layer — never in the UI alone" — there is
 * no service layer between the controller and the read-only aggregation
 * here, so the controller IS that second check, same as
 * `order.controller.ts` re-deriving `actor` itself rather than trusting
 * only route middleware).
 */
export const requireReportRead = () => [requireAuth(), requirePermission('reports.read')] as const;

export function assertReportExportPermission(actor: AuthenticatedUser): void {
  assertPermission(actor, 'reports.write');
}

export function requireAuthedUser(req: { user?: AuthenticatedUser }): AuthenticatedUser {
  if (!req.user) throw new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' });
  return req.user;
}
