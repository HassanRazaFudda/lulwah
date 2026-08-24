import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { AppError } from '../../shared/errors.js';
import { sendSuccess } from '../../shared/response.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as service from './inventory.service.js';
import { AdjustStockInput, AdminListInventoryQuery, ListMovementsQuery } from './inventory.dto.js';

/** Parse+validate (Zod) → call service → shape response. No business logic
 *  (plan.md §5.4). */

function requireAuthedUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' });
  return req.user;
}

export async function list(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = AdminListInventoryQuery.parse(req.query);
  const { items, total } = await service.adminListInventory(
    actor,
    { lowStock: query.lowStock, outOfStock: query.outOfStock, search: query.search },
    query.page,
    query.limit,
  );
  sendSuccess(res, { items }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function adjust(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const variantId = objectId.parse(req.params.variantId);
  const input = AdjustStockInput.parse(req.body);
  const result = await service.adjustStock(actor, variantId, input);
  sendSuccess(res, result);
}

export async function listMovements(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const variantId = objectId.parse(req.params.variantId);
  const query = ListMovementsQuery.parse(req.query);
  const { movements, total } = await service.adminListMovements(actor, variantId, query.page, query.limit);
  sendSuccess(res, { movements }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}
