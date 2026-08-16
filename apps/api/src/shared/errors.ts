import type { ErrorCode } from '@lulwah/contracts';

export interface AppErrorOptions {
  /** English message shown to the client (never a raw backend/db string). */
  messageEn: string;
  /** Arabic translation. Optional because not every code has one written yet.
   *  Explicitly `| undefined` (not just `?`) so call sites can pass through
   *  an already-optional value without a separate branch — `exactOptionalPropertyTypes`
   *  (plan.md §27.1) otherwise rejects `field: maybeUndefinedString`. */
  messageAr?: string | undefined;
  /** Dot-path to the offending field, e.g. `items[0].quantity` (plan.md §9.1). */
  field?: string | undefined;
  details?: Record<string, unknown> | undefined;
  /** The error this one was raised in response to — kept off the wire, logged only. */
  cause?: unknown;
}

/**
 * The one error class services throw — plan.md §27.4. A single Express
 * error middleware (`error-middleware.ts`) is the only place that turns
 * one of these into the §9.1 response envelope; nowhere else formats an
 * error response by hand.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly messageEn: string;
  readonly messageAr: string | undefined;
  readonly field: string | undefined;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, httpStatus: number, options: AppErrorOptions) {
    super(options.messageEn, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.messageEn = options.messageEn;
    this.messageAr = options.messageAr;
    this.field = options.field;
    this.details = options.details;
    Error.captureStackTrace?.(this, AppError);
  }
}

/** `VALIDATION_FAILED` for a request body/query/params that failed Zod parsing. */
export function validationError(messageEn: string, field?: string, details?: Record<string, unknown>): AppError {
  return new AppError('VALIDATION_FAILED', 400, { messageEn, field, details });
}

export function notFoundError(messageEn: string): AppError {
  return new AppError('NOT_FOUND', 404, { messageEn });
}
