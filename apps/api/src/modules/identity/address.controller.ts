import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { AppError } from '../../shared/errors.js';
import { sendSuccess } from '../../shared/response.js';
import type { AuthenticatedUser } from './identity.policy.js';
import * as service from './address.service.js';
import { CreateAddressInput, UpdateAddressInput } from './address.dto.js';

/** Parse+validate (Zod) → call service → shape response. No business logic
 *  (plan.md §5.4). */

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' });
  return req.user;
}

export async function list(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const addresses = await service.listAddresses(actor.id);
  sendSuccess(res, { addresses });
}

export async function create(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const input = CreateAddressInput.parse(req.body);
  const address = await service.createAddress(actor.id, input);
  sendSuccess(res, { address }, undefined, 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const input = UpdateAddressInput.parse(req.body);
  const address = await service.updateAddress(actor.id, objectId.parse(req.params.id), input);
  sendSuccess(res, { address });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  await service.deleteAddress(actor.id, objectId.parse(req.params.id));
  sendSuccess(res, {});
}

export async function setDefault(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const address = await service.setDefaultAddress(actor.id, objectId.parse(req.params.id));
  sendSuccess(res, { address });
}
