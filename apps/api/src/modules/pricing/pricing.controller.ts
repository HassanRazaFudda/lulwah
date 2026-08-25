import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { AppError } from '../../shared/errors.js';
import { sendSuccess } from '../../shared/response.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as service from './pricing.service.js';
import { AdminCreateDiscountInput, AdminListDiscountsQuery, AdminUpdateDiscountInput } from './pricing.dto.js';

/** Parse+validate (Zod) → call service → shape response. No business logic
 *  (plan.md §5.4). */

function requireAuthedUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' });
  return req.user;
}

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = AdminListDiscountsQuery.parse(req.query);
  const { discounts, total } = await service.adminListDiscounts(actor, { status: query.status, mode: query.mode, search: query.search }, query.page, query.limit);
  sendSuccess(res, { discounts }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const discount = await service.adminGetDiscount(actor, objectId.parse(req.params.id));
  sendSuccess(res, { discount });
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminCreateDiscountInput.parse(req.body);
  const discount = await service.createDiscount(actor, input);
  sendSuccess(res, { discount }, undefined, 201);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminUpdateDiscountInput.parse(req.body);
  const discount = await service.updateDiscount(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { discount });
}

export async function adminDelete(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  await service.deleteDiscount(actor, objectId.parse(req.params.id));
  sendSuccess(res, {});
}

export async function adminToggle(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const discount = await service.toggleDiscount(actor, objectId.parse(req.params.id));
  sendSuccess(res, { discount });
}
