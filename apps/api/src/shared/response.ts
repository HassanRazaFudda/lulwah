import type { Response } from 'express';
import type { ApiErrorShape, ResponseMeta } from '@lulwah/contracts';
import type { AppError } from './errors.js';

/**
 * Builders for the plan.md §9.1 response envelope. Controllers call
 * `sendSuccess`; `error-middleware.ts` is the only caller of
 * `sendError`/`errorShapeFromAppError` — no other code hand-rolls the
 * `{ success, error, requestId }` shape.
 */

export function sendSuccess<T>(res: Response, data: T, meta?: ResponseMeta, httpStatus = 200): void {
  res.status(httpStatus).json(meta ? { success: true, data, meta } : { success: true, data });
}

export function errorShapeFromAppError(error: AppError): ApiErrorShape {
  const shape: ApiErrorShape = { code: error.code, message: error.messageEn };
  if (error.messageAr !== undefined) shape.messageAr = error.messageAr;
  if (error.field !== undefined) shape.field = error.field;
  if (error.details !== undefined) shape.details = error.details;
  return shape;
}

export function sendError(res: Response, error: AppError, requestId: string): void {
  res.status(error.httpStatus).json({ success: false, error: errorShapeFromAppError(error), requestId });
}
