import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { AuditHttpMethod, UserRole } from '@lulwah/contracts';

/**
 * Mongoose schema for `audit_log` — plan.md §11.1's Audit log screen /
 * §7's `audit_logs` sketch, append-only (same pattern as
 * `inventory/stock-movement.model.ts`: no row is ever edited, only
 * inserted — no `updatedAt`, and no repository function outside
 * `audit.repository.ts` touches this model, per plan.md §5.3/§5.4).
 *
 * Written exclusively by `audit-log.middleware.ts` (via
 * `audit.service.ts#recordAuditEntry`), fire-and-forget, for every
 * mutating (`POST`/`PATCH`/`PUT`/`DELETE`) request under `/admin/*` — see
 * that middleware's doc comment for the full design rationale, including
 * why `requestBody`/`responseBody` stand in for a database-precise
 * `before`/`after` diff.
 */
export interface AuditLogDoc {
  _id: Types.ObjectId;
  actorId: Types.ObjectId | null;
  actorRole: UserRole | null;
  method: AuditHttpMethod;
  path: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  requestBody: unknown;
  responseBody: unknown;
  statusCode: number;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: null },
    method: { type: String, enum: ['POST', 'PATCH', 'PUT', 'DELETE'], required: true },
    path: { type: String, required: true },
    action: { type: String, required: true },
    entityType: { type: String, default: null },
    entityId: { type: String, default: null },
    requestBody: { type: Schema.Types.Mixed },
    responseBody: { type: Schema.Types.Mixed },
    statusCode: { type: Number, required: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    requestId: { type: String, default: null },
  },
  // Append-only — see this file's doc comment.
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_log' },
);

// plan.md §7's own index sketch for this table: "{ entityType:1, entityId:1,
// at:-1 }, { actorId:1, at:-1 }" (`at` there is this schema's `createdAt`).
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export type AuditLogHydratedDoc = HydratedDocument<AuditLogDoc>;
export const AuditLogModel = model<AuditLogDoc>('AuditLog', auditLogSchema);
