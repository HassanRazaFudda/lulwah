import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Express } from 'express';
import { createApp } from '../../../app.js';
import { connect, disconnect } from '../../../shared/mongo.js';
import { InMemoryRateLimitStore } from '../../../shared/rate-limit.js';
import { InMemoryReservationStore } from '../../cart/reservation-store.js';
import { InMemoryIdempotencyStore } from '../../checkout/idempotency-store.js';
import { SessionModel, UserModel } from '../../identity/identity.model.js';
import { DiscountModel } from '../../pricing/discount.model.js';
import { AuditLogModel } from '../audit.model.js';

/**
 * End-to-end integration coverage for the audit module — plan.md §11.1:
 * the real Express app, real `mongodb-memory-server`, real HTTP through
 * `supertest`, exercising real admin routes owned by OTHER modules
 * (`identity`, `pricing`) to prove the app-level middleware (mounted once
 * in `app.ts`, never touched inside those modules' own controllers)
 * actually captures their mutations.
 */

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connect(mongo.getUri());
  await Promise.all([UserModel.syncIndexes(), SessionModel.syncIndexes(), DiscountModel.syncIndexes(), AuditLogModel.syncIndexes()]);
}, 60_000);

afterAll(async () => {
  await disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), SessionModel.deleteMany({}), DiscountModel.deleteMany({}), AuditLogModel.deleteMany({})]);
});

function buildApp(): Express {
  return createApp({ rateLimitStore: new InMemoryRateLimitStore(), reservationStore: new InMemoryReservationStore(), idempotencyStore: new InMemoryIdempotencyStore() });
}

let phoneCounter = 550000000;

async function createUserAndLogin(app: Express, role: 'super_admin' | 'manager' | 'catalog' | 'customer' = 'super_admin'): Promise<{ token: string; userId: string }> {
  phoneCounter += 1;
  const email = `audit-user-${phoneCounter}@example.com`;
  const password = 'correct-horse-battery-staple';
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'A', lastName: 'B', phone: { countryCode: '+971', number: String(phoneCounter) } });
  const userId = registerRes.body.data.user.id as string;
  if (role !== 'customer') await UserModel.updateOne({ email }, { role });
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
  return { token: loginRes.body.data.accessToken as string, userId };
}

interface AuditEntryLike {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  method: string;
  path: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  requestBody: Record<string, unknown>;
  responseBody: unknown;
  statusCode: number;
}

/**
 * The write is deliberately fire-and-forget (see `audit-log.middleware
 * .ts`), so it races the HTTP response that triggered it — polling,
 * rather than asserting immediately, is the honest way to test that
 * without a flaky sleep tuned to this machine's speed.
 */
async function waitForAuditEntries(app: Express, token: string, query: Record<string, string>, minCount: number, timeoutMs = 5000): Promise<AuditEntryLike[]> {
  const start = Date.now();
  for (;;) {
    const res = await request(app).get('/api/v1/admin/audit-log').query(query).set('Authorization', `Bearer ${token}`);
    const entries = res.body.data.entries as AuditEntryLike[];
    if (entries.length >= minCount) return entries;
    if (Date.now() - start > timeoutMs) return entries;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe('audit log — capture middleware + admin read endpoint', () => {
  it('records a successful admin mutation owned by another module (identity: PATCH /admin/users/:id/role), redacting a secret field from the raw request body', async () => {
    const app = buildApp();
    const { token: actorToken, userId: actorId } = await createUserAndLogin(app, 'super_admin');
    const { userId: targetUserId } = await createUserAndLogin(app, 'customer');

    const mutateRes = await request(app)
      .patch(`/api/v1/admin/users/${targetUserId}/role`)
      .set('Authorization', `Bearer ${actorToken}`)
      // `password` isn't part of `UpdateUserRoleInput` — it'll be stripped
      // by the controller's own Zod parse, but the audit middleware reads
      // the RAW body before that happens, so this proves redaction runs
      // on real traffic, not just a hand-built fixture.
      .send({ role: 'manager', password: 'super-secret-value' });
    expect(mutateRes.status).toBe(200);

    const entries = await waitForAuditEntries(app, actorToken, { entityType: 'users', entityId: targetUserId }, 1);
    expect(entries).toHaveLength(1);
    const [entry] = entries;

    expect(entry?.method).toBe('PATCH');
    expect(entry?.path).toBe(`/admin/users/${targetUserId}/role`);
    expect(entry?.action).toBe('PATCH /admin/users/:id/role');
    expect(entry?.entityType).toBe('users');
    expect(entry?.entityId).toBe(targetUserId);
    expect(entry?.actorId).toBe(actorId);
    expect(entry?.actorRole).toBe('super_admin');
    expect(entry?.statusCode).toBe(200);
    expect(entry?.requestBody.role).toBe('manager');
    expect(entry?.requestBody.password).toBe('[REDACTED]');
    // "resulting state" — the response payload, captured verbatim. This is
    // the full §9.1 envelope handed to `res.json`, not just the inner
    // `data` — the middleware intercepts `res.json`'s argument directly.
    expect((entry?.responseBody as { data: { user: { role: string } } }).data.user.role).toBe('manager');
  });

  it('records a successful admin mutation owned by another module (pricing: POST /admin/discounts)', async () => {
    const app = buildApp();
    const { token } = await createUserAndLogin(app, 'super_admin');

    const createRes = await request(app)
      .post('/api/v1/admin/discounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Audit Test Discount', mode: 'automatic', type: 'percentage', value: 10, status: 'active' });
    expect(createRes.status).toBe(201);
    const discountId = createRes.body.data.discount.id as string;

    const entries = await waitForAuditEntries(app, token, { entityType: 'discounts' }, 1);
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry?.action).toBe('POST /admin/discounts');
    expect(entry?.entityType).toBe('discounts');
    expect(entry?.entityId).toBeNull(); // collection-level create — no id in the URL
    const responseBody = entry?.responseBody as { data: { discount: { id: string; createdAt: string } } };
    expect(responseBody.data.discount.id).toBe(discountId);
    // Also proves the Date-erasure bug (see `audit.redact.ts`'s doc
    // comment) stays fixed on a real end-to-end response, not just the
    // unit-level `audit.redact.test.ts` coverage.
    expect(responseBody.data.discount.createdAt).toBeTruthy();
  });

  it('records a failed/forbidden admin mutation attempt too (statusCode 403, actor still identified)', async () => {
    const app = buildApp();
    const { token } = await createUserAndLogin(app, 'catalog'); // no discounts.write

    const res = await request(app)
      .post('/api/v1/admin/discounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Should be forbidden', mode: 'automatic', type: 'percentage', value: 5 });
    expect(res.status).toBe(403);

    const { token: superToken } = await createUserAndLogin(app, 'super_admin');
    const entries = await waitForAuditEntries(app, superToken, { entityType: 'discounts' }, 1);
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry?.statusCode).toBe(403);
    expect(entry?.actorRole).toBe('catalog');
  });

  it('does NOT record a read-only (GET) admin request', async () => {
    const app = buildApp();
    const { token } = await createUserAndLogin(app, 'super_admin');

    await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${token}`);

    // No async write is ever scheduled for a GET (the middleware returns
    // early, before touching `res.json`/`res.on('finish')`), so this can
    // be asserted immediately rather than polled.
    const listRes = await request(app).get('/api/v1/admin/audit-log').set('Authorization', `Bearer ${token}`);
    expect(listRes.body.data.entries).toHaveLength(0);
  });

  it('does NOT record a mutation outside /admin/* (e.g. POST /auth/register)', async () => {
    const app = buildApp();
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-admin@example.com', password: 'correct-horse-battery-staple', firstName: 'A', lastName: 'B', phone: { countryCode: '+971', number: '501234567' } });

    const { token } = await createUserAndLogin(app, 'super_admin');
    const listRes = await request(app).get('/api/v1/admin/audit-log').set('Authorization', `Bearer ${token}`);
    expect(listRes.body.data.entries).toHaveLength(0);
  });

  describe('RBAC on GET /admin/audit-log', () => {
    it('super_admin can read the audit log', async () => {
      const app = buildApp();
      const { token } = await createUserAndLogin(app, 'super_admin');
      const res = await request(app).get('/api/v1/admin/audit-log').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('manager can read the audit log', async () => {
      const app = buildApp();
      const { token } = await createUserAndLogin(app, 'manager');
      const res = await request(app).get('/api/v1/admin/audit-log').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('a narrower operational role (catalog) is forbidden', async () => {
      const app = buildApp();
      const { token } = await createUserAndLogin(app, 'catalog');
      const res = await request(app).get('/api/v1/admin/audit-log').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('a plain customer is forbidden', async () => {
      const app = buildApp();
      const { token } = await createUserAndLogin(app, 'customer');
      const res = await request(app).get('/api/v1/admin/audit-log').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('an unauthenticated request is rejected', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/v1/admin/audit-log');
      expect(res.status).toBe(401);
    });
  });

  it('paginates and supports the §9.1 envelope meta shape', async () => {
    const app = buildApp();
    const { token } = await createUserAndLogin(app, 'super_admin');

    for (let i = 0; i < 3; i += 1) {
      // Sequential is intentional here: three real, distinct mutations,
      // not a fixture — no `no-await-in-loop` lint rule is registered in
      // this project to need silencing.
      await request(app)
        .post('/api/v1/admin/discounts')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Discount ${i}`, mode: 'automatic', type: 'percentage', value: 5 + i });
    }

    const entries = await waitForAuditEntries(app, token, { entityType: 'discounts' }, 3);
    expect(entries.length).toBeGreaterThanOrEqual(3);

    const page1 = await request(app).get('/api/v1/admin/audit-log').query({ limit: '2', page: '1' }).set('Authorization', `Bearer ${token}`);
    expect(page1.body.data.entries).toHaveLength(2);
    expect(page1.body.meta).toMatchObject({ page: 1, limit: 2 });
    expect(page1.body.meta.total).toBeGreaterThanOrEqual(3);
    expect(page1.body.meta.hasMore).toBe(true);
  });
});
