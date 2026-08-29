import { z } from 'zod';
import { objectId } from './common.js';
import { UserRole } from './enums.js';

/**
 * AuditLogEntry — plan.md §11.1's Audit log screen ("every mutating admin
 * action, filterable by actor/entity/date, with a before→after diff
 * viewer") and §7's `audit_logs` table sketch (`actorId, actorEmail,
 * action, entityType, entityId, before, after(diff), ip, userAgent, at`).
 *
 * **Deliberate departure from the plan's literal `before`/`after` naming**,
 * stated here so it's visible at the type level, not just in a service
 * comment: this build does not re-read each mutated document's
 * pre-mutation database state before writing the movement (that would mean
 * retrofitting a real read-before-write into every one of the ~7 existing
 * admin-mutating modules). Instead `requestBody` is "what was asked for"
 * and `responseBody` is "what the API actually returned" — a genuinely
 * useful diff of intent vs. outcome, just not a database-precise
 * before/after snapshot. See `apps/api/src/modules/audit/audit-log
 * .middleware.ts`'s doc comment for the full reasoning.
 */
export const AuditHttpMethod = z.enum(['POST', 'PATCH', 'PUT', 'DELETE']);
export type AuditHttpMethod = z.infer<typeof AuditHttpMethod>;

export const AuditLogEntry = z.object({
  id: objectId,
  actorId: objectId.nullable(), // null = the request never got past auth (e.g. a bad/missing token)
  actorRole: UserRole.nullable(),
  method: AuditHttpMethod,
  path: z.string(), // e.g. "/admin/orders/64f.../status"
  action: z.string(), // derived label, e.g. "PATCH /admin/orders/:id/status"
  entityType: z.string().nullable(), // e.g. "orders" — the first path segment after /admin/
  entityId: z.string().nullable(), // the first ObjectId-shaped path segment, if any
  // `.optional()`, not just `z.unknown()` alone — Zod v4 distinguishes a
  // genuinely absent object key from a key present with value `undefined`,
  // and rejects the former for a non-optional field even when the field's
  // own type (`unknown`) would happily accept `undefined` as a *value*.
  // A DELETE (and some other) requests send no JSON body at all, so
  // `audit-log.middleware.ts` never sets `requestBody` for them — the
  // Mongoose `Mixed` field with no `default` then omits the key entirely
  // from the stored document, and that same absent key survives all the
  // way to the wire. Found live: every list of real audit entries failed
  // to parse in `apps/admin` the moment it contained even one DELETE.
  requestBody: z.unknown().optional(), // redacted request payload — the "requested change"
  responseBody: z.unknown().optional(), // redacted response payload — the "resulting state"
  statusCode: z.number().int(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  requestId: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntry>;
