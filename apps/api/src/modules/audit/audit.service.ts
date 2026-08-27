import type { AuditLogEntry } from '@lulwah/contracts';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as repo from './audit.repository.js';
import type { AuditLogListFilter, CreateAuditEntryInput } from './audit.repository.js';
import { toAuditLogEntryDto } from './audit.mapper.js';

/**
 * ALL audit business rules live here, framework-free — no `express` import
 * (plan.md §5.4). Two very different callers, deliberately:
 *
 *  - `recordAuditEntry` is called by `audit-log.middleware.ts` for every
 *    mutating `/admin/*` request, unconditionally — it does NOT gate on
 *    any permission, because it isn't a user-invoked action, it's the
 *    write side of the audit trail itself. Its caller already treats the
 *    call as fire-and-forget (awaits it off the response path and
 *    swallows/logs any rejection) — this function itself still just
 *    awaits the repository write and lets a failure propagate, so the
 *    "never block/fail the real request" guarantee lives at the call
 *    site, not duplicated here.
 *  - `listAuditEntries` is the `GET /admin/audit-log` read path, gated on
 *    `audit.read` like every other admin read (plan.md §10.2).
 */

export async function recordAuditEntry(input: CreateAuditEntryInput): Promise<void> {
  await repo.createAuditEntry(input);
}

export async function listAuditEntries(
  actor: AuthenticatedUser,
  filter: AuditLogListFilter,
  page: number,
  limit: number,
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  assertPermission(actor, 'audit.read');
  const { entries, total } = await repo.listAuditEntries(filter, page, limit);
  return { entries: entries.map(toAuditLogEntryDto), total };
}
