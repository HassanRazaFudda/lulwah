import type { CookieOptions, Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from '../../config/constants.js';
import { env } from '../../shared/env.js';
import { AppError } from '../../shared/errors.js';
import { sendSuccess } from '../../shared/response.js';
import * as service from './identity.service.js';
import type { AuthResult, RequestContext } from './identity.service.js';
import { AdminListUsersQuery, InviteStaffInput, LoginInput, RegisterInput, UpdateUserRoleInput, UpdateUserStatusInput } from './identity.dto.js';
import type { AuthenticatedUser } from './identity.policy.js';

/**
 * Parse + validate (Zod) → call service → shape response. No business
 * logic (plan.md §5.4) — lockouts, rotation, reuse detection and RBAC all
 * live in `identity.service.ts`/`identity.policy.ts`; this file only
 * translates HTTP in and out of those calls.
 */

function requestContext(req: Request): RequestContext {
  return { ip: req.ip ?? null, userAgent: req.header('user-agent') ?? null };
}

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' });
  return req.user;
}

/** `exactOptionalPropertyTypes` means `domain`/`expires` must be omitted
 *  entirely when absent, never set to `undefined` (plan.md §27.1). */
function refreshCookieOptions(expires?: Date): CookieOptions {
  const options: CookieOptions = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  };
  if (env.COOKIE_DOMAIN) options.domain = env.COOKIE_DOMAIN;
  if (expires) options.expires = expires;
  return options;
}

function respondWithSession(res: Response, result: AuthResult, httpStatus = 200): void {
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions(result.refreshTokenExpiresAt));
  sendSuccess(res, { user: result.user, accessToken: result.accessToken }, undefined, httpStatus);
}

// ---------------------------------------------------------------------------
// Public auth — plan.md §9.3
// ---------------------------------------------------------------------------

export async function register(req: Request, res: Response): Promise<void> {
  const input = RegisterInput.parse(req.body);
  const { user } = await service.register(input);
  sendSuccess(res, { user }, undefined, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = LoginInput.parse(req.body);
  const result = await service.login(input, requestContext(req));
  respondWithSession(res, result);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const presented = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
  if (!presented) {
    throw new AppError('AUTH_TOKEN_EXPIRED', 401, { messageEn: 'Session expired. Please sign in again.' });
  }
  const result = await service.refresh(presented, requestContext(req));
  respondWithSession(res, result);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const presented = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
  await service.logout(presented);
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  sendSuccess(res, {});
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  await service.logoutAll(actor.id);
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  sendSuccess(res, {});
}

export async function me(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const user = await service.me(actor.id);
  sendSuccess(res, user);
}

/** `/auth/otp/*`, `/auth/google` — plan.md: "can be stub routes returning
 *  501 with a clear 'not implemented in this skeleton' error." */
export function notImplemented(feature: string) {
  return (_req: Request, _res: Response): void => {
    throw new AppError('SERVICE_UNAVAILABLE', 501, { messageEn: `${feature} is not implemented in this skeleton.` });
  };
}

// ---------------------------------------------------------------------------
// Admin — RBAC demonstration (plan.md §10.2)
// ---------------------------------------------------------------------------

export async function listUsers(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const query = AdminListUsersQuery.parse(req.query);
  const { users, total } = await service.listUsers(actor, query);
  const hasMore = query.page * query.limit < total;
  sendSuccess(res, { users }, { page: query.page, limit: query.limit, total, hasMore });
}

export async function updateUserRole(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const targetUserId = objectId.parse(req.params.id);
  const input = UpdateUserRoleInput.parse(req.body);
  const user = await service.updateUserRoleAsAdmin(actor, targetUserId, input.role);
  sendSuccess(res, { user });
}

/** `POST /admin/users/invite` — plan.md §11.1's "Invite staff." */
export async function inviteStaff(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const input = InviteStaffInput.parse(req.body);
  const { user, temporaryPassword } = await service.inviteStaffUser(actor, input);
  sendSuccess(res, { user, temporaryPassword }, undefined, 201);
}

/** `PATCH /admin/users/:id/status` — plan.md §11.1's "deactivate." */
export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const targetUserId = objectId.parse(req.params.id);
  const input = UpdateUserStatusInput.parse(req.body);
  const user = await service.updateUserStatusAsAdmin(actor, targetUserId, input.status);
  sendSuccess(res, { user });
}

/** `GET /admin/users/:id/sessions` — plan.md §11.1's "session list." */
export async function listUserSessions(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const targetUserId = objectId.parse(req.params.id);
  const sessions = await service.listUserSessions(actor, targetUserId);
  sendSuccess(res, { sessions });
}

/** `POST /admin/users/:id/sessions/:sessionId/revoke` — plan.md §11.1's
 *  "with revoke." */
export async function revokeUserSession(req: Request, res: Response): Promise<void> {
  const actor = requireUser(req);
  const targetUserId = objectId.parse(req.params.id);
  const sessionId = objectId.parse(req.params.sessionId);
  await service.revokeUserSession(actor, targetUserId, sessionId);
  sendSuccess(res, {});
}
