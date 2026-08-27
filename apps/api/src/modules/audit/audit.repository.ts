import type { QueryFilter } from 'mongoose';
import type { AuditHttpMethod, UserRole } from '@lulwah/contracts';
import { AuditLogModel } from './audit.model.js';
import type { AuditLogDoc, AuditLogHydratedDoc } from './audit.model.js';

/**
 * The ONLY file allowed to touch `AuditLogModel` (plan.md §5.4). Every
 * field here is already a plain string/primitive by the time it arrives
 * (the middleware/service never has a Mongoose-native `ObjectId` to hand
 * it), same "normalize at the repository boundary" pattern as
 * `order.repository.ts#CreateOrderInput`.
 */

export interface CreateAuditEntryInput {
  actorId: string | null;
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
}

export async function createAuditEntry(input: CreateAuditEntryInput): Promise<AuditLogHydratedDoc> {
  // Same "normalize plain strings at the boundary, cast once" pattern as
  // `order.repository.ts#createOrder` — every id field here is a plain
  // string, not Mongoose's native `Types.ObjectId`.
  return AuditLogModel.create(input as unknown as Parameters<typeof AuditLogModel.create>[0]);
}

export interface AuditLogListFilter {
  actorId?: string | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
}

export async function listAuditEntries(filter: AuditLogListFilter, page: number, limit: number): Promise<{ entries: AuditLogHydratedDoc[]; total: number }> {
  const query: QueryFilter<AuditLogDoc> = {};
  if (filter.actorId) query.actorId = filter.actorId;
  if (filter.entityType) query.entityType = filter.entityType;
  if (filter.entityId) query.entityId = filter.entityId;
  if (filter.dateFrom || filter.dateTo) {
    query.createdAt = {};
    if (filter.dateFrom) query.createdAt.$gte = filter.dateFrom;
    if (filter.dateTo) query.createdAt.$lte = filter.dateTo;
  }

  const [entries, total] = await Promise.all([
    AuditLogModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    AuditLogModel.countDocuments(query).exec(),
  ]);
  return { entries, total };
}
