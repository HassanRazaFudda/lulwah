import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Express } from 'express';
import { createApp } from '../../../app.js';
import { connect, disconnect } from '../../../shared/mongo.js';
import { InMemoryRateLimitStore } from '../../../shared/rate-limit.js';
import { InMemoryReservationStore } from '../../cart/reservation-store.js';
import { SessionModel, UserModel } from '../../identity/identity.model.js';
import { DiscountModel } from '../discount.model.js';

/** Integration coverage for `/admin/discounts` — plan.md §9.7's full CRUD
 *  + toggle, RBAC-gated. */

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connect(mongo.getUri());
  await Promise.all([UserModel.syncIndexes(), SessionModel.syncIndexes(), DiscountModel.syncIndexes()]);
}, 60_000);

afterAll(async () => {
  await disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), SessionModel.deleteMany({}), DiscountModel.deleteMany({})]);
});

function buildApp(): Express {
  return createApp({ rateLimitStore: new InMemoryRateLimitStore(), reservationStore: new InMemoryReservationStore() });
}

let phoneCounter = 530000000;

async function createUserAndLogin(app: Express, role: 'super_admin' | 'catalog' | 'customer' = 'super_admin'): Promise<string> {
  phoneCounter += 1;
  const email = `user-${phoneCounter}@example.com`;
  const password = 'correct-horse-battery-staple';
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'A', lastName: 'B', phone: { countryCode: '+971', number: String(phoneCounter) } });
  if (role !== 'customer') await UserModel.updateOne({ email }, { role });
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
  return loginRes.body.data.accessToken as string;
}

describe('POST /api/v1/admin/discounts', () => {
  it('creates a code-mode discount', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app);

    const res = await request(app)
      .post('/api/v1/admin/discounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Lawn 26 Launch', mode: 'code', code: 'lawn26', type: 'percentage', value: 15, appliesTo: 'all', status: 'active' });

    expect(res.status).toBe(201);
    expect(res.body.data.discount.code).toBe('LAWN26'); // uppercased
    expect(res.body.data.discount.usage.usedCount).toBe(0);
  });

  it('rejects a code-mode discount with no code', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app);
    const res = await request(app).post('/api/v1/admin/discounts').set('Authorization', `Bearer ${token}`).send({ name: 'Bad', mode: 'code', type: 'percentage', value: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate code with CONFLICT', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app);
    const body = { name: 'A', mode: 'code' as const, code: 'DUPE', type: 'percentage' as const, value: 10 };
    await request(app).post('/api/v1/admin/discounts').set('Authorization', `Bearer ${token}`).send(body);
    const res = await request(app).post('/api/v1/admin/discounts').set('Authorization', `Bearer ${token}`).send(body);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('a plain customer cannot create a discount (403)', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app, 'customer');
    const res = await request(app).post('/api/v1/admin/discounts').set('Authorization', `Bearer ${token}`).send({ name: 'A', mode: 'automatic', type: 'percentage', value: 10 });
    expect(res.status).toBe(403);
  });
});

describe('discount CRUD + toggle lifecycle', () => {
  it('lists, gets, updates (without wiping usedCount), toggles, and deletes', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app);

    const createRes = await request(app)
      .post('/api/v1/admin/discounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sitewide', mode: 'automatic', type: 'percentage', value: 10, status: 'active' });
    const id = createRes.body.data.discount.id as string;

    // Simulate an order having redeemed it once already (what the future
    // `order` module's `incrementUsedCount` would do).
    await DiscountModel.updateOne({ _id: id }, { $inc: { 'usage.usedCount': 1 } });

    const listRes = await request(app).get('/api/v1/admin/discounts').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.discounts).toHaveLength(1);

    const getRes = await request(app).get(`/api/v1/admin/discounts/${id}`).set('Authorization', `Bearer ${token}`);
    expect(getRes.body.data.discount.usage.usedCount).toBe(1);

    const updateRes = await request(app).patch(`/api/v1/admin/discounts/${id}`).set('Authorization', `Bearer ${token}`).send({ value: 20, usage: { limitTotal: 100, limitPerCustomer: null } });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.discount.value).toBe(20);
    expect(updateRes.body.data.discount.usage.limitTotal).toBe(100);
    // The real assertion: patching `usage.limitTotal` must not reset the
    // real `usedCount` back to 0 (dot-path update, not a whole-subdoc replace).
    expect(updateRes.body.data.discount.usage.usedCount).toBe(1);

    const toggleRes = await request(app).post(`/api/v1/admin/discounts/${id}/toggle`).set('Authorization', `Bearer ${token}`);
    expect(toggleRes.body.data.discount.status).toBe('disabled');
    const toggleBackRes = await request(app).post(`/api/v1/admin/discounts/${id}/toggle`).set('Authorization', `Bearer ${token}`);
    expect(toggleBackRes.body.data.discount.status).toBe('active');

    const deleteRes = await request(app).delete(`/api/v1/admin/discounts/${id}`).set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
    const afterDelete = await request(app).get(`/api/v1/admin/discounts/${id}`).set('Authorization', `Bearer ${token}`);
    expect(afterDelete.status).toBe(404);
  });
});
