import type { Request, Response } from 'express';
import { AppError } from '../../shared/errors.js';
import { sendSuccess } from '../../shared/response.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as service from './audit.service.js';
import { AdminListAuditLogQuery } from './audit.dto.js';

/** Parse+validate (Zod) → call service → shape response. No business logic
 *  (plan.md §5.4). */

function requireAuthedUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' });
  return req.user;
}

export async function list(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = AdminListAuditLogQuery.parse(req.query);
  const { entries, total } = await service.listAuditEntries(
    actor,
    { actorId: query.actorId, entityType: query.entityType, entityId: query.entityId, dateFrom: query.dateFrom, dateTo: query.dateTo },
    query.page,
    query.limit,
  );
  sendSuccess(res, { entries }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}
