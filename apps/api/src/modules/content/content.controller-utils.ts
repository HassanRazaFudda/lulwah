import type { Request } from 'express';
import { AppError } from '../../shared/errors.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';

/**
 * Every admin controller in this module needs `req.user` after
 * `requireAuth()` has already run — same tiny shared guard
 * `catalog.controller-utils.ts#requireAuthedUser` uses, since `content`
 * also has several admin controller files that all need it.
 */
export function requireAuthedUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' });
  return req.user;
}
