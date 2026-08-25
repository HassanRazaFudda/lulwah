import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { AppError } from '../../shared/errors.js';
import { sendSuccess } from '../../shared/response.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as service from './order.service.js';
import { AdminAddOrderNoteInput, AdminListOrdersQuery, MeOrdersQuery, TrackOrderQuery, UpdateOrderStatusInput } from './order.dto.js';

/** Parse+validate (Zod) → call service → shape response. No business logic
 *  (plan.md §5.4). */

function requireAuthedUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' });
  return req.user;
}

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = AdminListOrdersQuery.parse(req.query);
  const { orders, total } = await service.adminListOrders(actor, { status: query.status, paymentStatus: query.paymentStatus, search: query.search }, query.page, query.limit);
  sendSuccess(res, { orders }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const order = await service.adminGetOrder(actor, objectId.parse(req.params.id));
  sendSuccess(res, { order });
}

export async function adminUpdateStatus(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = UpdateOrderStatusInput.parse(req.body);
  const order = await service.updateOrderStatus(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { order });
}

export async function adminAddNote(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminAddOrderNoteInput.parse(req.body);
  const order = await service.addAdminNote(actor, objectId.parse(req.params.id), input.note);
  sendSuccess(res, { order }, undefined, 201);
}

export async function meList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = MeOrdersQuery.parse(req.query);
  const { orders, total } = await service.getMyOrders(actor.id, query.page, query.limit);
  sendSuccess(res, { orders }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function meGetByNumber(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const order = await service.getMyOrderByNumber(actor.id, req.params.orderNumber as string);
  sendSuccess(res, { order });
}

export async function track(req: Request, res: Response): Promise<void> {
  const query = TrackOrderQuery.parse(req.query);
  const order = await service.trackOrder(query.orderNumber, query.emailOrPhone);
  sendSuccess(res, { order });
}
