import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors.js';
import { errorMiddleware } from '../error-middleware.js';

/**
 * Unit test for the one thing plan.md §27.4 is strict about: an
 * `AppError` (or anything else thrown) always becomes the §9.1 envelope,
 * and an unknown error's real message/stack never reaches the client
 * even though it's still logged server-side with the request id.
 */

interface MockResponse {
  status: (code: number) => MockResponse;
  json: (body: unknown) => MockResponse;
  statusCode?: number;
  body?: unknown;
}

function createMockRes(): Response & MockResponse {
  const res = {} as Response & MockResponse;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as unknown as Response['status'];
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  }) as unknown as Response['json'];
  return res;
}

function createMockReq(): Request {
  return { id: 'req_test123', log: { warn: vi.fn(), error: vi.fn() } } as unknown as Request;
}

describe('errorMiddleware', () => {
  const middleware = errorMiddleware();

  it('maps an AppError to the §9.1 envelope using its own code and httpStatus', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();
    const error = new AppError('AUTH_INVALID_CREDENTIALS', 401, {
      messageEn: 'Incorrect email or password.',
      messageAr: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    });

    middleware(error, req, res, next as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Incorrect email or password.',
        messageAr: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      },
      requestId: 'req_test123',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('carries field and details through for a field-level AppError (e.g. OUT_OF_STOCK)', () => {
    const req = createMockReq();
    const res = createMockRes();
    const error = new AppError('OUT_OF_STOCK', 409, {
      messageEn: 'Only 2 pieces of this size are left.',
      field: 'items[0].quantity',
      details: { available: 2 },
    });

    middleware(error, req, res, vi.fn() as unknown as NextFunction);

    const body = res.body as { error: { field?: string; details?: Record<string, unknown> } };
    expect(body.error.field).toBe('items[0].quantity');
    expect(body.error.details).toEqual({ available: 2 });
  });

  it('maps a ZodError to VALIDATION_FAILED (400) with the first issue as the field', () => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: 'not-an-email' });
    if (result.success) throw new Error('expected schema validation to fail');

    const req = createMockReq();
    const res = createMockRes();

    middleware(result.error, req, res, vi.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.body as { success: boolean; error: { code: string; field?: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.field).toBe('email');
  });

  it('never leaks an unknown error message or stack — always a generic INTERNAL_ERROR, but still logs it', () => {
    const req = createMockReq();
    const res = createMockRes();
    const secret = new Error('connection string: mongodb://admin:hunter2@prod-db');

    middleware(secret, req, res, vi.fn() as unknown as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.body as { success: boolean; error: { code: string; message: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('hunter2');
    expect(JSON.stringify(body)).not.toContain('hunter2');
    // ... but it was NOT swallowed — logged server-side with the request id.
    expect(req.log.error).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req_test123' }), expect.any(String));
  });

  it('echoes the requestId from req.id into the error envelope', () => {
    const req = { id: 'req_specific_456', log: { warn: vi.fn(), error: vi.fn() } } as unknown as Request;
    const res = createMockRes();
    const error = new AppError('NOT_FOUND', 404, { messageEn: 'Not found.' });

    middleware(error, req, res, vi.fn() as unknown as NextFunction);

    expect((res.body as { requestId: string }).requestId).toBe('req_specific_456');
  });
});
