import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { API_PREFIX, JSON_BODY_LIMIT } from './config/constants.js';
import { env } from './shared/env.js';
import { AppError } from './shared/errors.js';
import { errorMiddleware } from './shared/error-middleware.js';
import { requestId } from './shared/request-id.js';
import { sendSuccess } from './shared/response.js';
import type { RateLimitStore } from './shared/rate-limit.js';
import { createIdentityRouter } from './modules/identity/identity.routes.js';
import { createCatalogRouter } from './modules/catalog/catalog.routes.js';
import { createInventoryRouter } from './modules/inventory/inventory.routes.js';
import { createCartRouter } from './modules/cart/cart.routes.js';
import type { ReservationStore } from './modules/cart/reservation-store.js';
import { createPricingRouter } from './modules/pricing/pricing.routes.js';
import { createOrderRouter } from './modules/order/order.routes.js';
import { createCheckoutRouter } from './modules/checkout/checkout.routes.js';
import type { IdempotencyStore } from './modules/checkout/idempotency-store.js';
import { createPaymentRouter } from './modules/payment/payment.routes.js';
import { createSettingsRouter } from './modules/settings/settings.routes.js';
import { createContentRouter } from './modules/content/content.routes.js';
import { createCustomerRouter } from './modules/customer/customer.routes.js';
import { createAuditRouter } from './modules/audit/audit.routes.js';
import { auditLogMiddleware } from './modules/audit/audit-log.middleware.js';

/** The one route that must never go through the global JSON body parser —
 *  see this file's doc comment on `ZIINA_WEBHOOK_PATH`. */
const ZIINA_WEBHOOK_PATH = `${API_PREFIX}/webhooks/ziina`;

export interface CreateAppOptions {
  rateLimitStore: RateLimitStore;
  reservationStore: ReservationStore;
  idempotencyStore: IdempotencyStore;
}

/**
 * Express app factory (plan.md §5.4). Middleware order is load-bearing:
 * security headers → CORS → cookies → body parsing → request-id →
 * routes → error middleware LAST — only a 4-arg handler registered after
 * every route is treated as an error handler by Express.
 *
 * No `express-async-errors` import: Express 5.2+ natively forwards a
 * rejected promise from an `async` route handler to `next(err)` (the
 * feature that package existed to backport onto Express 4). It's also
 * simply broken on Express 5 — the published build still does
 * `require('express/lib/router/layer')`, a path Express 5 no longer
 * ships, so importing it here throws at boot instead of at request time.
 *
 * Returns a plain `Express` app, never calling `.listen()` — that split
 * is what lets `supertest` drive the app directly in tests without a
 * real socket (`server.ts` is the only place that listens).
 */
export function createApp({ rateLimitStore, reservationStore, idempotencyStore }: CreateAppOptions): Express {
  const app = express();

  app.disable('x-powered-by');
  // Every real deployment sits behind Caddy/Cloudflare (plan.md §36) —
  // trust the first hop's X-Forwarded-For so `req.ip` is the real client,
  // which the per-IP rate limiter depends on.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: [env.WEB_URL, env.ADMIN_URL],
      credentials: true, // the refresh-token cookie requires this (plan.md §10.1)
    }),
  );
  app.use(cookieParser());

  // Ziina webhook signature verification (plan.md §9.6, docs/ziina
  // -integration-notes.md §6) needs the exact raw request bytes — the
  // `X-Hmac-Signature` header is an HMAC over those, not a semantically-
  // equivalent re-serialization of the parsed JSON, so this one path must
  // never go through `express.json()`. Express has no clean "skip global
  // middleware for one path" primitive, so this dispatches per-request
  // instead of registering two competing `app.use()` calls.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === ZIINA_WEBHOOK_PATH) {
      express.raw({ type: 'application/json', limit: JSON_BODY_LIMIT })(req, res, next);
    } else {
      express.json({ limit: JSON_BODY_LIMIT })(req, res, next);
    }
  });

  app.use(requestId());

  app.get(`${API_PREFIX}/health`, (_req: Request, res: Response) => {
    sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() });
  });

  // Audit capture (plan.md §11.1) — mounted ONCE, ahead of every admin
  // router below, rather than edited into each one's controllers. Wraps
  // every mutating (`POST`/`PATCH`/`PUT`/`DELETE`) `/admin/*` request
  // regardless of which module owns it; see `audit-log.middleware.ts`'s
  // doc comment for the full design (and its honest before/after
  // tradeoff). Self-filtering by path/method, so mounting it before the
  // routers — rather than after, or duplicated per-router — is just the
  // one place it needs to be to see every admin request exactly once.
  app.use(API_PREFIX, auditLogMiddleware());

  app.use(API_PREFIX, createIdentityRouter({ rateLimitStore }));
  app.use(API_PREFIX, createCatalogRouter());
  app.use(API_PREFIX, createInventoryRouter());
  app.use(API_PREFIX, createCartRouter({ reservationStore }));
  app.use(API_PREFIX, createPricingRouter());
  app.use(API_PREFIX, createOrderRouter({ rateLimitStore }));
  app.use(API_PREFIX, createCheckoutRouter({ reservationStore, idempotencyStore }));
  app.use(API_PREFIX, createPaymentRouter());
  app.use(API_PREFIX, createSettingsRouter());
  app.use(API_PREFIX, createContentRouter());
  app.use(API_PREFIX, createCustomerRouter());
  app.use(API_PREFIX, createAuditRouter());

  // Anything under /api/v1 that no router claimed still gets the §9.1
  // envelope, never Express's default HTML 404 — modules not built yet
  // (cart, order, ...) 404 the same way a typo'd real route would.
  app.use(API_PREFIX, (_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError('NOT_FOUND', 404, { messageEn: 'Not found.' }));
  });

  app.use(errorMiddleware());

  return app;
}
