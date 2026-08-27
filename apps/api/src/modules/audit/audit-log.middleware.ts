import type { NextFunction, Request, Response } from 'express';
import type { AuditHttpMethod } from '@lulwah/contracts';
import * as service from './audit.service.js';
import { deriveAuditMeta } from './audit.path.js';
import { redactSecrets } from './audit.redact.js';

const MUTATING_METHODS: ReadonlySet<string> = new Set<AuditHttpMethod>(['POST', 'PATCH', 'PUT', 'DELETE']);
const ADMIN_PREFIX = '/admin/';

function isMutatingAdminRequest(req: Request): boolean {
  return MUTATING_METHODS.has(req.method) && (req.path === '/admin' || req.path.startsWith(ADMIN_PREFIX));
}

/**
 * Generic capture middleware — plan.md §11.1's Audit log screen ("every
 * mutating admin action"). Mounted ONCE, at the router level in `app.ts`,
 * ahead of every module's own router — not edited into any of the ~7
 * existing admin-mutating modules' controllers. It self-filters to
 * `POST`/`PATCH`/`PUT`/`DELETE` requests whose Express-relative path is
 * under `/admin/*`, so where exactly it's mounted relative to the other
 * routers doesn't change which requests it catches — only whether
 * `req.user` is reliably set by the time it *reads* that field, which is
 * why it reads `req.user` lazily inside the `finish` handler below
 * (by then every route-level `requireAuth()` earlier in the same
 * request's middleware chain has already run), not eagerly up front.
 *
 * ## The "before→after diff" tradeoff — read before changing this file
 *
 * plan.md's own `audit_logs` sketch (§7) names `before`/`after` fields,
 * implying a database read of the entity's state immediately before and
 * after the mutation. This middleware deliberately does NOT do that.
 * Retrofitting a true pre-mutation DB snapshot would mean either
 * (a) reading each entity inside every one of the ~7 existing
 * admin-mutating modules' services before they run — invasive, duplicated
 * per-module work across already-tested code, and it still wouldn't be
 * *this* file doing it — or (b) this middleware itself reaching into
 * every other module's Mongoose model to read the entity by the id parsed
 * out of the URL, which is exactly the cross-module-model-import plan.md
 * §5.3 forbids and this repo's own ESLint boundary rule polices.
 *
 * Instead: `requestBody` captures what the client asked for (the
 * "requested change"), and `responseBody` captures what the API actually
 * returned (the "resulting state" — every admin mutation in this codebase
 * responds with the full updated entity, per the §9.1 envelope
 * convention, so this is a real, complete post-mutation snapshot, just
 * never paired with a pre-mutation one). That's a genuinely useful diff
 * view — "what was sent vs. what came back" — but it is **not** a
 * database-precise before/after diff. This comment exists so that
 * distinction is recorded accurately rather than overstated later.
 *
 * ## Fire-and-forget, genuinely
 *
 * The audit write is kicked off inside the `res.on('finish')` handler —
 * an event that fires only AFTER the response has already been sent to
 * the client — and its promise is never awaited by the request/response
 * cycle; a rejection is caught and logged, never re-thrown, never
 * surfaced to the client. A MongoDB outage affecting only this collection
 * can therefore never fail, delay, or roll back the underlying admin
 * action.
 */
export function auditLogMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isMutatingAdminRequest(req)) {
      next();
      return;
    }

    const method = req.method as AuditHttpMethod;
    const path = req.path;
    const { action, entityType, entityId } = deriveAuditMeta(method, path);
    const requestBody = redactSecrets(req.body);

    // Capture the response body without changing what's actually sent —
    // `sendSuccess`/`sendError` (and hence every controller and the error
    // middleware) always go through `res.json`, so patching this one
    // method on this one request's `res` is sufficient; the original is
    // still called with the exact same body.
    let responseBody: unknown;
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      responseBody = body;
      return originalJson(body);
    }) as unknown as Response['json'];

    res.on('finish', () => {
      service
        .recordAuditEntry({
          actorId: req.user?.id ?? null,
          actorRole: req.user?.role ?? null,
          method,
          path,
          action,
          entityType,
          entityId,
          requestBody,
          responseBody: redactSecrets(responseBody),
          statusCode: res.statusCode,
          ip: req.ip ?? null,
          userAgent: req.header('user-agent') ?? null,
          requestId: req.id,
        })
        .catch((err: unknown) => {
          req.log?.error({ err, requestId: req.id }, 'failed to write audit log entry');
        });
    });

    next();
  };
}
