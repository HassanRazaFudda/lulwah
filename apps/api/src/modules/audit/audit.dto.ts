import { z } from 'zod';
import { AuditLogEntry, objectId } from '@lulwah/contracts';

/**
 * Request/response DTOs for `GET /admin/audit-log` (plan.md §11.1:
 * "filterable by actor/entity/date"). `AuditLogEntry` itself lives in
 * `@lulwah/contracts`, reused as-is — same "DTO composes the contract
 * type, never redefines it" pattern as `order.dto.ts`.
 */

export const AdminListAuditLogQuery = z.object({
  actorId: objectId.optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type AdminListAuditLogQuery = z.infer<typeof AdminListAuditLogQuery>;

export const AdminAuditLogListResponse = z.object({ entries: z.array(AuditLogEntry) });
export type AdminAuditLogListResponse = z.infer<typeof AdminAuditLogListResponse>;
