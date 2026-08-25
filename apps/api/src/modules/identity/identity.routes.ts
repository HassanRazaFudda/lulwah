import { Router } from 'express';
import { AUTH_RATE_LIMIT } from '../../config/constants.js';
import { createRateLimiter } from '../../shared/rate-limit.js';
import type { RateLimitStore } from '../../shared/rate-limit.js';
import * as controller from './identity.controller.js';
import * as addressController from './address.controller.js';
import { requireAuth, requirePermission } from './identity.policy.js';

export interface IdentityRouterDeps {
  rateLimitStore: RateLimitStore;
}

/**
 * HTTP wiring only (plan.md §5.4) — path, middleware, handler binding, no
 * logic. Mounted at `API_PREFIX` by `app.ts`, so routes below resolve to
 * `/api/v1/auth/*` (plan.md §9.3) and a small `/api/v1/admin/users*`
 * slice of §9.7 (the RBAC demonstration — `identity` owns `User`/RBAC,
 * so it owns this much of `/admin/*`; the rest belongs to the modules
 * that own those resources once they exist).
 *
 * `rateLimitStore` is injected rather than constructed here so
 * integration tests can pass `InMemoryRateLimitStore` and never need a
 * real Redis (see `shared/rate-limit.ts`).
 */
export function createIdentityRouter({ rateLimitStore }: IdentityRouterDeps): Router {
  const router = Router();

  // plan.md §9.8: "auth 10/min/IP" — the whole auth surface, including
  // the authenticated endpoints (/me, /logout-all), not just login.
  const authLimiter = createRateLimiter(rateLimitStore, { ...AUTH_RATE_LIMIT, keyPrefix: 'auth' });

  const auth = Router();
  auth.use(authLimiter);
  auth.post('/register', controller.register);
  auth.post('/login', controller.login);
  auth.post('/refresh', controller.refresh);
  auth.post('/logout', controller.logout);
  auth.post('/logout-all', requireAuth(), controller.logoutAll);
  auth.get('/me', requireAuth(), controller.me);
  // plan.md: OTP/Google can be stubs — "501 with a clear 'not
  // implemented in this skeleton' error."
  auth.post('/otp/request', controller.notImplemented('OTP'));
  auth.post('/otp/verify', controller.notImplemented('OTP'));
  auth.post('/google', controller.notImplemented('Google sign-in'));
  router.use('/auth', auth);

  const admin = Router();
  admin.get('/users', requireAuth(), requirePermission('users.read'), controller.listUsers);
  admin.patch('/users/:id/role', requireAuth(), requirePermission('users.write'), controller.updateUserRole);
  router.use('/admin', admin);

  // plan.md §9.4 — Address lives under `identity` (§5.3's module-ownership
  // table), auth-required throughout: a logged-in customer manages only
  // their own address book.
  const me = Router();
  me.get('/addresses', requireAuth(), addressController.list);
  me.post('/addresses', requireAuth(), addressController.create);
  me.patch('/addresses/:id', requireAuth(), addressController.update);
  me.delete('/addresses/:id', requireAuth(), addressController.remove);
  me.post('/addresses/:id/default', requireAuth(), addressController.setDefault);
  router.use('/me', me);

  return router;
}
