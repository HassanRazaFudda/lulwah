import type { Request } from 'express';
import { AppError } from '../../shared/errors.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';

/**
 * Every admin controller in this module needs `req.user` after
 * `requireAuth()` has already run, and `POST /me/reviews` needs a real
 * logged-in customer too — same tiny shared guard `content
 * .controller-utils.ts#requireAuthedUser`/`customer.controller.ts`'s local
 * copy use, since `engagement` also has several controller files that all
 * need it.
 */
export function requireAuthedUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' });
  return req.user;
}
