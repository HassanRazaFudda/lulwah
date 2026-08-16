import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from './errors.js';
import { sendError } from './response.js';

/** Structural shape of the errors `body-parser`/`express.json()` throws
 *  (bad JSON, payload over the §9.8 1 MB limit) — narrowed with `unknown`,
 *  never cast (plan.md §27.1: no `any`). */
function isHttpLikeError(err: unknown): err is { status: number; message: string; type?: string } {
  return typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status: unknown }).status === 'number';
}

/**
 * The single place that turns a thrown error into the plan.md §9.1
 * envelope. Must be registered LAST, after every route (Express only
 * treats a 4-arg function as error-handling middleware). Paired with
 * `express-async-errors` (imported once in `app.ts`) so a `throw` inside
 * an `async` route handler lands here too, not as an unhandled rejection.
 */
export function errorMiddleware() {
  // `_next` is unused but required — Express only treats a 4-arg function
  // as error-handling middleware, and it's registered last (app.ts) so
  // there's never a next handler to call anyway.
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = req.id ?? 'unknown';

    if (err instanceof AppError) {
      const logPayload = { err: { code: err.code, message: err.message }, requestId };
      if (err.httpStatus >= 500) req.log?.error(logPayload, 'request failed');
      else req.log?.warn(logPayload, 'request rejected');
      sendError(res, err, requestId);
      return;
    }

    if (err instanceof ZodError) {
      const first = err.issues[0];
      const appError = new AppError('VALIDATION_FAILED', 400, {
        messageEn: first?.message ?? 'Validation failed',
        field: first?.path.join('.'),
        details: { issues: err.issues },
      });
      req.log?.warn({ err: appError, requestId }, 'validation failed');
      sendError(res, appError, requestId);
      return;
    }

    if (isHttpLikeError(err) && err.status >= 400 && err.status < 500) {
      // e.g. malformed JSON body, or over the §9.8 1 MB payload limit.
      const appError = new AppError('VALIDATION_FAILED', err.status, { messageEn: err.message });
      req.log?.warn({ err: appError, requestId }, 'request rejected');
      sendError(res, appError, requestId);
      return;
    }

    // Anything else is a bug or an infra failure. Log the real thing with
    // its stack for us — the client never sees it (plan.md §27.4: "Never
    // leak a stack trace to a client. Every caught error is logged with
    // its requestId.").
    req.log?.error({ err, requestId }, 'unhandled error');
    const fallback = new AppError('INTERNAL_ERROR', 500, {
      messageEn: 'Something went wrong. Please try again.',
    });
    sendError(res, fallback, requestId);
  };
}
