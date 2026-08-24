import type { Request } from 'express';
import { AppError } from '../../shared/errors.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';

/**
 * Every admin controller in this module needs `req.user` after
 * `requireAuth()` has already run — this is the same tiny guard
 * `identity.controller.ts` keeps locally as `requireUser`, shared here
 * because `catalog` has five admin controller files that all need it
 * rather than one.
 */
export function requireAuthedUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' });
  return req.user;
}
