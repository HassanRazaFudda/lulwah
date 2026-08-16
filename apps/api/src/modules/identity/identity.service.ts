import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { LoginInput, RegisterInput, User, UserRole } from '@lulwah/contracts';
import { env } from '../../shared/env.js';
import { AppError, notFoundError } from '../../shared/errors.js';
import * as repo from './identity.repository.js';
import { toPublicUser } from './identity.mapper.js';
import { identityEvents } from './identity.events.js';
import { assertPermission, effectivePermissions } from './identity.policy.js';
import type { AccessTokenPayload, AuthenticatedUser } from './identity.policy.js';
import type { UserHydratedDoc } from './identity.model.js';

/**
 * ALL identity business rules live here, framework-free (no `express`
 * import — plan.md §5.4). `identity.controller.ts` only parses/shapes;
 * `identity.repository.ts` only queries Mongoose.
 */

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

// --- tunables (plan.md §10.1) ---------------------------------------------

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_BASE_MS = 15 * 60_000;
const LOCKOUT_MAX_MS = 24 * 60 * 60_000;
const REFRESH_TTL_MS = parseDurationMs(env.JWT_REFRESH_TTL);

// --- small pure helpers ------------------------------------------------

function parseDurationMs(ttl: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(ttl);
  const value = match?.[1];
  const unit = match?.[2];
  if (!value || !unit) throw new Error(`Invalid duration string: "${ttl}"`);
  const multipliers: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(value) * (multipliers[unit] ?? 0);
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

function parseOpaqueToken(token: string): { sessionId: string; secret: string } | null {
  const separator = token.indexOf('.');
  if (separator <= 0 || separator === token.length - 1) return null;
  return { sessionId: token.slice(0, separator), secret: token.slice(separator + 1) };
}

function expiredSessionError(): AppError {
  return new AppError('AUTH_TOKEN_EXPIRED', 401, { messageEn: 'Session expired. Please sign in again.' });
}

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: env.ARGON2_MEMORY,
    timeCost: env.ARGON2_TIME,
    parallelism: 1,
  });
}

function signAccessToken(payload: AccessTokenPayload): string {
  // env.JWT_ACCESS_TTL is a validated-but-general `string` (e.g. "15m");
  // jsonwebtoken's own type is a narrower literal-pattern union it can't
  // derive from `string` alone, and `exactOptionalPropertyTypes` (plan.md
  // §27.1) rejects a `| undefined`-including cast on an optional prop —
  // so this asserts the non-undefined half of that union.
  const expiresIn = env.JWT_ACCESS_TTL as NonNullable<jwt.SignOptions['expiresIn']>;
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn });
}

function computeLockDurationMs(failedLoginCount: number): number {
  const extraFailures = Math.max(0, failedLoginCount - LOCKOUT_THRESHOLD);
  return Math.min(LOCKOUT_BASE_MS * 2 ** extraFailures, LOCKOUT_MAX_MS);
}

// --- registration ---------------------------------------------------------

export async function register(input: RegisterInput): Promise<{ user: User }> {
  const passwordHash = await hashPassword(input.password);
  try {
    const doc = await repo.createUser({
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash,
      provider: 'local',
      firstName: input.firstName,
      lastName: input.lastName,
      role: 'customer',
    });
    const user = toPublicUser(doc);
    identityEvents.publish('user.registered', { user });
    return { user };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError('AUTH_EMAIL_EXISTS', 409, {
        messageEn: 'An account with this email already exists.',
        field: 'email',
      });
    }
    throw err;
  }
}

// --- login / session issuance ----------------------------------------------

/** Shared by `login` and `refresh` — mints a brand-new session row plus
 *  its matching access/refresh token pair. `family` is passed through on
 *  rotation so the whole chain shares one id (plan.md §10.1); omitted on
 *  a fresh login, where a new family begins. */
async function issueSession(userDoc: UserHydratedDoc, ctx: RequestContext, family: string = randomUUID()): Promise<AuthResult> {
  const sessionId = new Types.ObjectId();
  const secret = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await repo.createSession({
    _id: sessionId,
    userId: userDoc._id,
    family,
    tokenHash: sha256Hex(secret),
    expiresAt,
    userAgent: ctx.userAgent,
    ip: ctx.ip,
  });

  const permissions = effectivePermissions(userDoc.role, userDoc.permissions);
  const accessToken = signAccessToken({ sub: userDoc.id, role: userDoc.role, permissions, sessionId: sessionId.toString() });

  return {
    user: toPublicUser(userDoc),
    accessToken,
    refreshToken: `${sessionId.toString()}.${secret}`,
    refreshTokenExpiresAt: expiresAt,
  };
}

async function handleFailedLogin(userDoc: UserHydratedDoc): Promise<void> {
  const updated = await repo.incrementFailedLoginCount(userDoc.id);
  const failedCount = updated?.failedLoginCount ?? userDoc.failedLoginCount + 1;
  // plan.md §10.1: "5 failed logins → 15-minute lock, exponential thereafter."
  if (failedCount >= LOCKOUT_THRESHOLD) {
    await repo.lockUser(userDoc.id, new Date(Date.now() + computeLockDurationMs(failedCount)));
  }
}

export async function login(input: LoginInput, ctx: RequestContext): Promise<AuthResult> {
  const userDoc = await repo.findUserByEmail(input.email);
  const invalidCredentials = () =>
    new AppError('AUTH_INVALID_CREDENTIALS', 401, { messageEn: 'Incorrect email or password.' });

  if (!userDoc || !userDoc.passwordHash) throw invalidCredentials();

  if (userDoc.lockedUntil && userDoc.lockedUntil.getTime() > Date.now()) {
    throw new AppError('AUTH_ACCOUNT_LOCKED', 423, {
      messageEn: 'Too many failed attempts. Please try again later.',
      details: { lockedUntil: userDoc.lockedUntil.toISOString() },
    });
  }

  const passwordValid = await argon2.verify(userDoc.passwordHash, input.password);
  if (!passwordValid) {
    await handleFailedLogin(userDoc);
    throw invalidCredentials();
  }

  await repo.recordSuccessfulLogin(userDoc.id, ctx.ip);
  return issueSession(userDoc, ctx);
}

// --- refresh rotation + reuse detection (plan.md §10.1) --------------------

/**
 * Rotates on every use. A refresh token that matches a session we've
 * already rotated away from (or otherwise revoked) is proof the exact
 * token we issued is being replayed — from a stolen cookie, a second
 * device, or a client bug — so the entire rotation family is revoked and
 * the caller is forced to re-authenticate. This is deliberately stricter
 * than "token not found": a hash *mismatch* for a known session id is
 * just an invalid/forged token and is rejected WITHOUT revoking anything,
 * so an attacker who only knows a session id (e.g. leaked via the access
 * token's `sessionId` claim) can't force-revoke someone else's session by
 * guessing a secret.
 */
export async function refresh(presentedToken: string, ctx: RequestContext): Promise<AuthResult> {
  const parsed = parseOpaqueToken(presentedToken);
  const session = parsed ? await repo.findSessionById(parsed.sessionId) : null;
  if (!parsed || !session) throw expiredSessionError();

  if (sha256Hex(parsed.secret) !== session.tokenHash) throw expiredSessionError();
  if (session.expiresAt.getTime() <= Date.now()) throw expiredSessionError();

  if (session.revokedAt) {
    await repo.revokeFamily(session.family, 'reuse_detected');
    throw new AppError('AUTH_TOKEN_REUSED', 401, {
      messageEn:
        'This session was used from another location and has been revoked for your security. Please sign in again.',
    });
  }

  const userDoc = await repo.findUserById(session.userId.toString());
  if (!userDoc || userDoc.status !== 'active') throw expiredSessionError();

  await repo.revokeSession(session._id, 'rotated');
  return issueSession(userDoc, ctx, session.family);
}

// --- logout ---------------------------------------------------------------

export async function logout(presentedToken: string | undefined): Promise<void> {
  if (!presentedToken) return;
  const parsed = parseOpaqueToken(presentedToken);
  if (!parsed) return;
  const session = await repo.findSessionById(parsed.sessionId);
  if (!session || sha256Hex(parsed.secret) !== session.tokenHash) return;
  await repo.revokeSession(session._id, 'logout');
}

export async function logoutAll(userId: string): Promise<void> {
  await repo.revokeAllSessionsForUser(userId, 'logout_all');
}

// --- profile ----------------------------------------------------------------

export async function me(userId: string): Promise<User> {
  const userDoc = await repo.findUserById(userId);
  if (!userDoc) throw notFoundError('User not found.');
  return toPublicUser(userDoc);
}

// --- admin (RBAC demonstration — plan.md §10.2) -----------------------------

export async function listUsers(
  actor: AuthenticatedUser,
  query: { page: number; limit: number },
): Promise<{ users: User[]; total: number }> {
  // Route-level `requirePermission('users.read')` already guards this;
  // re-checked here so the rule holds even if a future caller reaches
  // this service function directly (plan.md §10.2: "re-checked in the
  // service layer — never in the UI alone").
  assertPermission(actor, 'users.read');
  const [docs, total] = await Promise.all([repo.findUsersPage(query.page, query.limit), repo.countUsers()]);
  return { users: docs.map(toPublicUser), total };
}

export async function updateUserRoleAsAdmin(actor: AuthenticatedUser, targetUserId: string, role: UserRole): Promise<User> {
  assertPermission(actor, 'users.write');
  const updated = await repo.updateUserRole(targetUserId, role);
  if (!updated) throw notFoundError('User not found.');
  return toPublicUser(updated);
}
