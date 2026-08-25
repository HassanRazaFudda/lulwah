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

export interface CreateAppOptions {
  rateLimitStore: RateLimitStore;
  reservationStore: ReservationStore;
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
export function createApp({ rateLimitStore, reservationStore }: CreateAppOptions): Express {
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
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(requestId());

  app.get(`${API_PREFIX}/health`, (_req: Request, res: Response) => {
    sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(API_PREFIX, createIdentityRouter({ rateLimitStore }));
  app.use(API_PREFIX, createCatalogRouter());
  app.use(API_PREFIX, createInventoryRouter());
  app.use(API_PREFIX, createCartRouter({ reservationStore }));
  app.use(API_PREFIX, createPricingRouter());

  // Anything under /api/v1 that no router claimed still gets the §9.1
  // envelope, never Express's default HTML 404 — modules not built yet
  // (cart, order, ...) 404 the same way a typo'd real route would.
  app.use(API_PREFIX, (_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError('NOT_FOUND', 404, { messageEn: 'Not found.' }));
  });

  app.use(errorMiddleware());

  return app;
}
