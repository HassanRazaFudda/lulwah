import type { Request, Response } from 'express';
import { AppError } from '../../shared/errors.js';
import { sendSuccess } from '../../shared/response.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as service from './settings.service.js';
import { AdminUpdateSettingsInput } from './settings.dto.js';

/** Parse+validate (Zod) → call service → shape response. No business logic
 *  (plan.md §5.4). */

function requireAuthedUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' });
  return req.user;
}

export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const settings = await service.adminGetSettings(actor);
  sendSuccess(res, { settings });
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminUpdateSettingsInput.parse(req.body);
  const settings = await service.adminUpdateSettings(actor, input);
  sendSuccess(res, { settings });
}
