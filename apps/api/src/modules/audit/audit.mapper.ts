import type { AuditLogEntry } from '@lulwah/contracts';
import type { AuditLogHydratedDoc } from './audit.model.js';

/** Mongoose doc → wire DTO. Straight field-for-field copy (same pattern as
 *  `inventory.mapper.ts`) — the only real work is stringifying ObjectIds. */
export function toAuditLogEntryDto(doc: AuditLogHydratedDoc): AuditLogEntry {
  return {
    id: doc._id.toString(),
    actorId: doc.actorId ? doc.actorId.toString() : null,
    actorRole: doc.actorRole,
    method: doc.method,
    path: doc.path,
    action: doc.action,
    entityType: doc.entityType,
    entityId: doc.entityId,
    requestBody: doc.requestBody,
    responseBody: doc.responseBody,
    statusCode: doc.statusCode,
    ip: doc.ip,
    userAgent: doc.userAgent,
    requestId: doc.requestId,
    createdAt: doc.createdAt,
  };
}
