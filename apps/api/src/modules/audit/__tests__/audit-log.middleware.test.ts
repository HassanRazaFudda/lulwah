import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { auditLogMiddleware } from '../audit-log.middleware.js';

const recordAuditEntryMock = vi.fn();
vi.mock('../audit.service.js', () => ({ recordAuditEntry: (...args: unknown[]) => recordAuditEntryMock(...(args as [unknown])) }));

/**
 * Unit coverage for the one property an integration test can't easily
 * prove under real timing: that a failing/slow audit write can NEVER
 * fail, delay, or otherwise touch the underlying admin response — the
 * whole point of "fire-and-forget" (see `audit-log.middleware.ts`'s own
 * doc comment). `audit.service.ts` is mocked directly so this test
 * controls exactly when/whether the write resolves, independent of a
 * real MongoDB.
 */

function createMockReq(overrides: Partial<Request> = {}): Request {
  const base = {
    method: 'PATCH',
    path: '/admin/orders/64f0a1b2c3d4e5f6a7b8c9d0/status',
    body: { status: 'confirmed', password: 'nope' },
    user: { id: 'actor1', role: 'super_admin', permissions: [], sessionId: 's1' },
    id: 'req_test1',
    log: { error: vi.fn() },
    ip: '127.0.0.1',
    header: (name: string) => (name.toLowerCase() === 'user-agent' ? 'vitest' : undefined),
  };
  return { ...base, ...overrides } as unknown as Request;
}

interface MockRes {
  _finishHandlers: (() => void)[];
  _trigger: () => void;
}

function createMockRes(): Response & MockRes {
  const finishHandlers: (() => void)[] = [];
  const res = { statusCode: 200, _finishHandlers: finishHandlers } as unknown as Response & MockRes;
  res.json = vi.fn((body: unknown) => {
    (res as unknown as { body: unknown }).body = body;
    return res;
  }) as unknown as Response['json'];
  res.on = vi.fn((event: string, cb: () => void) => {
    if (event === 'finish') finishHandlers.push(cb);
    return res;
  }) as unknown as Response['on'];
  res._trigger = () => finishHandlers.forEach((h) => h());
  return res;
}

afterEach(() => {
  recordAuditEntryMock.mockReset();
});

describe('auditLogMiddleware', () => {
  it('lets next() run immediately — scheduling the write only happens on the finish event, never before', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();
    recordAuditEntryMock.mockReturnValue(new Promise(() => {})); // never resolves

    auditLogMiddleware()(req, res, next);
    res.json({ ok: true });

    expect(next).toHaveBeenCalledTimes(1);
    // `finish` was never triggered in this test, so even with a
    // never-resolving mock, the write was never even started.
    expect(recordAuditEntryMock).not.toHaveBeenCalled();
  });

  it('a rejected audit write is caught and logged, never thrown or left unhandled', async () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();
    recordAuditEntryMock.mockRejectedValue(new Error('mongo is down'));

    auditLogMiddleware()(req, res, next);
    res.json({ ok: true });
    (res as unknown as MockRes)._trigger(); // simulate the response having finished sending

    // Flush the microtask queue so the `.catch` handler runs.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(recordAuditEntryMock).toHaveBeenCalledTimes(1);
    expect(req.log.error).toHaveBeenCalledTimes(1);
  });

  it('skips entirely for a GET request — no res.json patch, no finish listener registered', () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    const next = vi.fn();

    auditLogMiddleware()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.on).not.toHaveBeenCalled();
  });

  it('skips entirely for a mutating request outside /admin/*', () => {
    const req = createMockReq({ method: 'POST', path: '/auth/register', body: { email: 'a@b.com', password: 'x' } });
    const res = createMockRes();
    const next = vi.fn();

    auditLogMiddleware()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.on).not.toHaveBeenCalled();
  });

  it('redacts secret fields in the request body and derives action/entityType/entityId before handing off to the service', async () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();
    recordAuditEntryMock.mockResolvedValue(undefined);

    auditLogMiddleware()(req, res, next);
    res.json({ order: { status: 'confirmed' } });
    (res as unknown as MockRes)._trigger();
    await Promise.resolve();

    expect(recordAuditEntryMock).toHaveBeenCalledTimes(1);
    const call = recordAuditEntryMock.mock.calls[0]?.[0] as {
      requestBody: { password: string; status: string };
      responseBody: { order: { status: string } };
      entityType: string;
      entityId: string;
      action: string;
      actorId: string;
      actorRole: string;
      statusCode: number;
    };
    expect(call.requestBody.password).toBe('[REDACTED]');
    expect(call.requestBody.status).toBe('confirmed');
    expect(call.responseBody.order.status).toBe('confirmed');
    expect(call.entityType).toBe('orders');
    expect(call.entityId).toBe('64f0a1b2c3d4e5f6a7b8c9d0');
    expect(call.action).toBe('PATCH /admin/orders/:id/status');
    expect(call.actorId).toBe('actor1');
    expect(call.actorRole).toBe('super_admin');
  });

  it('records actorId/actorRole as null when the request never reached an authenticated user (e.g. auth rejected upstream)', async () => {
    const req = createMockReq({ user: undefined });
    const res = createMockRes();
    const next = vi.fn();
    recordAuditEntryMock.mockResolvedValue(undefined);

    auditLogMiddleware()(req, res, next);
    res.statusCode = 401;
    res.json({ success: false });
    (res as unknown as MockRes)._trigger();
    await Promise.resolve();

    const call = recordAuditEntryMock.mock.calls[0]?.[0] as { actorId: string | null; actorRole: string | null; statusCode: number };
    expect(call.actorId).toBeNull();
    expect(call.actorRole).toBeNull();
    expect(call.statusCode).toBe(401);
  });
});
