/** Path-versioned base — plan.md §9.8: breaking changes ship as `/v2`,
 *  `/v1` stays supported for 6 months after. */
export const API_PREFIX = '/api/v1';

/** §9.8: 1 MB JSON body limit (media upload routes get their own, larger
 *  limit once the catalog module lands). */
export const JSON_BODY_LIMIT = '1mb';

/** httpOnly refresh-token cookie — plan.md §10.1. Scoped to the auth
 *  router path so it's never sent on every request, only where it's
 *  actually read (`/refresh`, `/logout`). */
export const REFRESH_COOKIE_NAME = 'lulwah_refresh';
export const REFRESH_COOKIE_PATH = `${API_PREFIX}/auth`;

/** §9.8: "Rate limits ... auth 10/min/IP." Per-endpoint overrides live
 *  next to the route that needs them; this is the auth-router default. */
export const AUTH_RATE_LIMIT = { windowMs: 60_000, max: 10 } as const;

/** §9.8: "admin 300/min/user." Not yet wired to a limiter (no admin
 *  session concept beyond the identity module's own RBAC demo), kept
 *  here so the constant exists once admin routes multiply. */
export const ADMIN_RATE_LIMIT = { windowMs: 60_000, max: 300 } as const;
