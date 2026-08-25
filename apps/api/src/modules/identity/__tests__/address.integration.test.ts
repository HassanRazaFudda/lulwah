import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Express } from 'express';
import { createApp } from '../../../app.js';
import { connect, disconnect } from '../../../shared/mongo.js';
import { InMemoryRateLimitStore } from '../../../shared/rate-limit.js';
import { InMemoryReservationStore } from '../../cart/reservation-store.js';
import { SessionModel, UserModel } from '../identity.model.js';
import { AddressModel } from '../address.model.js';

/**
 * Integration coverage for `/me/addresses` — plan.md §9.4. UAE addressing
 * (area/building/landmark, no postcode) and auth scoping (a customer can
 * never read/edit another customer's address) are the two things worth
 * proving beyond plain CRUD.
 */

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connect(mongo.getUri());
  await Promise.all([UserModel.syncIndexes(), SessionModel.syncIndexes(), AddressModel.syncIndexes()]);
}, 60_000);

afterAll(async () => {
  await disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), SessionModel.deleteMany({}), AddressModel.deleteMany({})]);
});

function buildApp(): Express {
  return createApp({ rateLimitStore: new InMemoryRateLimitStore(), reservationStore: new InMemoryReservationStore() });
}

let phoneCounter = 540000000;

async function registerAndLogin(app: Express): Promise<string> {
  phoneCounter += 1;
  const email = `user-${phoneCounter}@example.com`;
  const password = 'correct-horse-battery-staple';
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'A', lastName: 'B', phone: { countryCode: '+971', number: String(phoneCounter) } });
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
  return loginRes.body.data.accessToken as string;
}

const SAMPLE_ADDRESS = {
  firstName: 'Fatima',
  lastName: 'Al Marzooqi',
  phone: { countryCode: '+971', number: '501234567' },
  emirate: 'dubai',
  city: 'Dubai',
  area: 'Al Barsha',
  buildingName: 'Marina Heights',
  landmark: 'Near Mall of the Emirates',
};

describe('POST /api/v1/me/addresses', () => {
  it('requires authentication', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/v1/me/addresses').send(SAMPLE_ADDRESS);
    expect(res.status).toBe(401);
  });

  it('creates an address and makes the first one the default automatically', async () => {
    const app = buildApp();
    const token = await registerAndLogin(app);

    const res = await request(app).post('/api/v1/me/addresses').set('Authorization', `Bearer ${token}`).send(SAMPLE_ADDRESS);
    expect(res.status).toBe(201);
    expect(res.body.data.address.isDefaultShipping).toBe(true);
    expect(res.body.data.address.isDefaultBilling).toBe(true);
    expect(res.body.data.address.area).toBe('Al Barsha');
    expect(res.body.data.address.landmark).toBe('Near Mall of the Emirates');
    // UAE addressing — no postcode field at all in the response.
    expect(res.body.data.address.postcode).toBeUndefined();
    expect(res.body.data.address.country).toBe('AE');
  });

  it('rejects an address missing the UAE-required area/landmark fields', async () => {
    const app = buildApp();
    const token = await registerAndLogin(app);
    const incomplete: Partial<typeof SAMPLE_ADDRESS> = { ...SAMPLE_ADDRESS };
    delete incomplete.area;
    delete incomplete.landmark;
    const res = await request(app).post('/api/v1/me/addresses').set('Authorization', `Bearer ${token}`).send(incomplete);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/me/addresses', () => {
  it('only returns the logged-in customer’s own addresses', async () => {
    const app = buildApp();
    const tokenA = await registerAndLogin(app);
    const tokenB = await registerAndLogin(app);

    await request(app).post('/api/v1/me/addresses').set('Authorization', `Bearer ${tokenA}`).send(SAMPLE_ADDRESS);
    await request(app)
      .post('/api/v1/me/addresses')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ ...SAMPLE_ADDRESS, area: 'JLT' });

    const resA = await request(app).get('/api/v1/me/addresses').set('Authorization', `Bearer ${tokenA}`);
    expect(resA.body.data.addresses).toHaveLength(1);
    expect(resA.body.data.addresses[0].area).toBe('Al Barsha');
  });
});

describe('PATCH /api/v1/me/addresses/:id', () => {
  it('updates one field without resetting the others (the Zod .partial()-with-defaults bug)', async () => {
    const app = buildApp();
    const token = await registerAndLogin(app);
    const createRes = await request(app)
      .post('/api/v1/me/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...SAMPLE_ADDRESS, makani: '12345678', isDefaultShipping: true });
    const id = createRes.body.data.address.id as string;
    expect(createRes.body.data.address.makani).toBe('12345678');

    const updateRes = await request(app).patch(`/api/v1/me/addresses/${id}`).set('Authorization', `Bearer ${token}`).send({ city: 'Abu Dhabi' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.address.city).toBe('Abu Dhabi');
    // The regression this test exists for: an unrelated single-field PATCH
    // must not silently wipe `makani` back to null or `isDefaultShipping`
    // back to false.
    expect(updateRes.body.data.address.makani).toBe('12345678');
    expect(updateRes.body.data.address.isDefaultShipping).toBe(true);
  });

  it('a customer cannot update another customer’s address (404, not leaked)', async () => {
    const app = buildApp();
    const tokenA = await registerAndLogin(app);
    const tokenB = await registerAndLogin(app);
    const createRes = await request(app).post('/api/v1/me/addresses').set('Authorization', `Bearer ${tokenA}`).send(SAMPLE_ADDRESS);
    const id = createRes.body.data.address.id as string;

    const res = await request(app).patch(`/api/v1/me/addresses/${id}`).set('Authorization', `Bearer ${tokenB}`).send({ city: 'Sharjah' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/me/addresses/:id/default and DELETE', () => {
  it('setting a new default clears the previous one, and delete removes it', async () => {
    const app = buildApp();
    const token = await registerAndLogin(app);
    const first = await request(app).post('/api/v1/me/addresses').set('Authorization', `Bearer ${token}`).send(SAMPLE_ADDRESS);
    const second = await request(app)
      .post('/api/v1/me/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...SAMPLE_ADDRESS, area: 'JLT', label: 'work' });

    expect(first.body.data.address.isDefaultShipping).toBe(true);
    expect(second.body.data.address.isDefaultShipping).toBe(false);

    const setDefaultRes = await request(app)
      .post(`/api/v1/me/addresses/${second.body.data.address.id}/default`)
      .set('Authorization', `Bearer ${token}`);
    expect(setDefaultRes.body.data.address.isDefaultShipping).toBe(true);

    const listRes = await request(app).get('/api/v1/me/addresses').set('Authorization', `Bearer ${token}`);
    const firstNow = listRes.body.data.addresses.find((a: { id: string }) => a.id === first.body.data.address.id);
    expect(firstNow.isDefaultShipping).toBe(false); // exclusivity enforced

    const deleteRes = await request(app).delete(`/api/v1/me/addresses/${first.body.data.address.id}`).set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
    const afterDelete = await request(app).get('/api/v1/me/addresses').set('Authorization', `Bearer ${token}`);
    expect(afterDelete.body.data.addresses).toHaveLength(1);
  });
});
