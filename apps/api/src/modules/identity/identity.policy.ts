import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { UserRole } from '@lulwah/contracts';
import { env } from '../../shared/env.js';
import { AppError } from '../../shared/errors.js';

/**
 * RBAC — plan.md §10.2. Permission strings are the source of truth;
 * roles are just named bundles of them, and a user can hold extra
 * individual grants beyond their role (`User.permissions`, plan.md
 * §7.1). This module only wires up the columns the identity module
 * itself can enforce end-to-end (`users.read`/`users.write`, on the
 * `/admin/users` demo routes in `identity.routes.ts`); the rest of the
 * matrix (`orders.status.update`, `products.write`, `settings.write`, …)
 * is declared here as data so the pattern generalizes the moment
 * `order`/`catalog`/`analytics` modules land and need it — plan.md's own
 * scope note: "you don't need every permission string ... enough to
 * prove the pattern works."
 */
export const PERMISSIONS = [
  'products.read',
  'products.write',
  'inventory.read',
  'inventory.write',
  'orders.read',
  'orders.status.update',
  'refunds.write',
  'discounts.read',
  'discounts.write',
  'customers.read',
  'customers.write',
  'content.read',
  'content.write',
  'reports.read',
  'reports.write',
  'settings.read',
  'settings.write',
  'users.read',
  'users.write',
  'audit.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS;

/** Transcribed from the plan.md §10.2 table: ✏️ write implies read (both
 *  granted), 👁 is read-only, `—` grants nothing.
 *  `warehouse`/`support`'s "✏️*" (restricted status-transition subset)
 *  is a state-machine rule the `order` module's own policy must enforce
 *  once it exists — the permission string only proves they may attempt a
 *  status update at all, not which transitions. */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  manager: [
    'products.read', 'products.write',
    'inventory.read', 'inventory.write',
    'orders.read', 'orders.status.update',
    'refunds.write',
    'discounts.read', 'discounts.write',
    'customers.read', 'customers.write',
    'content.read', 'content.write',
    'reports.read',
    'settings.read',
    'users.read',
    // An audit trail of every admin's mutating actions is itself sensitive
    // (it can reveal, e.g., a customer's address/phone that a support
    // agent touched, or the internal reasoning in a discount edit), so
    // this is deliberately NOT handed to every operational role the way
    // `products.read`/`orders.read` are — `catalog`/`order_ops`/
    // `warehouse`/`support`/`content`/`finance` all stay without it,
    // limited to their own remit's data, not everyone else's. `manager`
    // gets it because holding a team accountable for its own actions
    // (who changed that price, who force-transitioned that order) is
    // exactly what the manager role is for, one level under `super_admin`
    // who needs it unconditionally.
    'audit.read',
  ],
  catalog: ['products.read', 'products.write', 'inventory.read', 'inventory.write', 'discounts.read', 'content.read', 'content.write', 'reports.read'],
  order_ops: ['products.read', 'inventory.read', 'orders.read', 'orders.status.update', 'discounts.read', 'customers.read', 'reports.read'],
  warehouse: ['products.read', 'inventory.read', 'inventory.write', 'orders.read', 'orders.status.update'],
  support: ['products.read', 'inventory.read', 'orders.read', 'orders.status.update', 'discounts.read', 'customers.read', 'customers.write'],
  content: ['products.read', 'content.read', 'content.write', 'reports.read'],
  finance: ['products.read', 'inventory.read', 'orders.read', 'refunds.write', 'discounts.read', 'customers.read', 'reports.read', 'reports.write'],
  customer: [], // storefront only — plan.md §10.2
} as const;

/** Union of a role's bundle plus any extra individual grants stored on
 *  the user (`User.permissions`, plan.md §7.1). Computed once at
 *  login/refresh time and embedded in the access-token claims so every
 *  request doesn't re-hit the database to know what a user can do. */
export function effectivePermissions(role: UserRole, extraPermissions: readonly string[]): string[] {
  return Array.from(new Set([...ROLE_PERMISSIONS[role], ...extraPermissions]));
}

// ---------------------------------------------------------------------------
// Access-token claims — plan.md §10.1: "sub, role, permissions[],
// sessionId, iat, exp".
// ---------------------------------------------------------------------------

export const AccessTokenClaims = z.object({
  sub: z.string(),
  role: UserRole,
  permissions: z.array(z.string()),
  sessionId: z.string(),
  iat: z.number(),
  exp: z.number(),
});
export type AccessTokenClaims = z.infer<typeof AccessTokenClaims>;
export type AccessTokenPayload = Omit<AccessTokenClaims, 'iat' | 'exp'>;

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  permissions: string[];
  sessionId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `requireAuth()` after verifying the access-token JWT. */
    user?: AuthenticatedUser;
  }
}

/** Verifies the `Authorization: Bearer <accessToken>` header and attaches
 *  `req.user`. Does NOT touch the database — the JWT signature plus the
 *  15-minute TTL is the trust boundary (plan.md §10.1); routes that need
 *  fresh data (`/auth/me`) look the user up themselves. */
export function requireAuth() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      next(new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' }));
      return;
    }
    try {
      const decoded = jwt.verify(header.slice('Bearer '.length), env.JWT_ACCESS_SECRET);
      const claims = AccessTokenClaims.parse(decoded);
      req.user = { id: claims.sub, role: claims.role, permissions: claims.permissions, sessionId: claims.sessionId };
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        next(new AppError('AUTH_TOKEN_EXPIRED', 401, { messageEn: 'Session expired. Please sign in again.' }));
        return;
      }
      next(new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Invalid authentication token.' }));
    }
  };
}

/** Throws `AUTH_FORBIDDEN` if `user` lacks `permission`. Exported so
 *  services can call it a second time on top of the route-level
 *  `requirePermission` middleware — plan.md §10.2: "Enforced by
 *  `requirePermission(...)` middleware AND re-checked in the service
 *  layer — never in the UI alone." */
export function assertPermission(user: AuthenticatedUser, permission: Permission): void {
  if (!user.permissions.includes(permission)) {
    throw new AppError('AUTH_FORBIDDEN', 403, {
      messageEn: `Missing required permission: ${permission}.`,
      details: { permission },
    });
  }
}

/** Route-level guard. Requires `requireAuth()` to run first. */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('AUTH_FORBIDDEN', 401, { messageEn: 'Authentication required.' }));
      return;
    }
    try {
      assertPermission(req.user, permission);
      next();
    } catch (err) {
      next(err);
    }
  };
}
