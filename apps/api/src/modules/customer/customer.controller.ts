import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { AppError } from '../../shared/errors.js';
import { sendSuccess } from '../../shared/response.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as service from './customer.service.js';
import { AdminGetCustomerQuery, AdminListCustomersQuery, UpdateCustomerInput } from './customer.dto.js';

/** Parse+validate (Zod) → call service → shape response. No business logic
 *  (plan.md §5.4). */

function requireAuthedUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' });
  return req.user;
}

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = AdminListCustomersQuery.parse(req.query);
  const { customers, total } = await service.adminListCustomers(actor, query);
  sendSuccess(res, { customers }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const id = objectId.parse(req.params.id);
  const query = AdminGetCustomerQuery.parse(req.query);
  const detail = await service.adminGetCustomer(actor, id, query.ordersPage, query.ordersLimit);
  sendSuccess(res, detail);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const id = objectId.parse(req.params.id);
  const input = UpdateCustomerInput.parse(req.body);
  const customer = await service.adminUpdateCustomer(actor, id, input);
  sendSuccess(res, { customer });
}
