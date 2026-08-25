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

/** Guest-cart cookie — plan.md §8.5: "cookie `lulwah_cart`, `SameSite=Lax`,
 *  `Secure`, 30-day TTL." Deliberately its own cookie, never the identity
 *  module's refresh-token cookie — a cart must survive without a login. */
export const CART_COOKIE_NAME = 'lulwah_cart';
export const CART_COOKIE_TTL_MS = 30 * 24 * 60 * 60_000;

/** plan.md §8.5 cart rules. */
export const CART_MAX_QTY_PER_LINE = 10;
export const CART_MAX_LINES = 50;

/** plan.md §8.4: stock reservation TTLs. `CHECKOUT` is declared for the
 *  `checkout` module (not built in this phase) to extend into once a cart
 *  enters checkout — kept here now so that module doesn't have to touch
 *  this file's cart-owned constants later. */
export const CART_RESERVATION_TTL_MS = 20 * 60_000;
export const CHECKOUT_RESERVATION_TTL_MS = 45 * 60_000;

/** plan.md §8.4: "acquire a Redis lock `lock:variant:{id}`" — single-Redis-
 *  instance deployment (plan.md §36), so a plain `SET NX PX` is sufficient;
 *  no redlock library. Short TTL — only a crash-safety net, since every
 *  acquirer releases explicitly in a `finally`. */
export const VARIANT_LOCK_TTL_MS = 3_000;
export const VARIANT_LOCK_MAX_RETRIES = 30;
export const VARIANT_LOCK_RETRY_DELAY_MS = 50;

/**
 * A well-known sentinel `ObjectId` for stock movements the system itself
 * performs (cart reservations/releases) rather than a human admin —
 * `StockMovement.performedBy` (plan.md §7.8) is a required user reference
 * with no "system" actor modeled in `users` (plan.md §7.1). All-zero is
 * Mongo's own convention for "no real id" and can never collide with a
 * real `ObjectId` (those always encode a non-zero timestamp).
 */
export const SYSTEM_ACTOR_ID = '000000000000000000000000';
