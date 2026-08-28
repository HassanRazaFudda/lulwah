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
import { BrandModel } from '../brand.model.js';
import { CategoryModel } from '../category.model.js';
import { CollectionModel } from '../collection.model.js';
import { ProductModel } from '../product.model.js';
import { VariantModel } from '../variant.model.js';

/**
 * Integration coverage for the P3 extension to `catalog`'s Collection —
 * plan.md §7.9/§11.1: `type: 'automated'` + `rules[]` resolves its
 * `productIds` live from the current catalog, rather than a stored,
 * manually-curated array.
 */

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connect(mongo.getUri());
  await Promise.all([
    UserModel.syncIndexes(),
    SessionModel.syncIndexes(),
    BrandModel.syncIndexes(),
    CategoryModel.syncIndexes(),
    CollectionModel.syncIndexes(),
    ProductModel.syncIndexes(),
    VariantModel.syncIndexes(),
  ]);
}, 60_000);

afterAll(async () => {
  await disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    UserModel.deleteMany({}),
    SessionModel.deleteMany({}),
    BrandModel.deleteMany({}),
    CategoryModel.deleteMany({}),
    CollectionModel.deleteMany({}),
    ProductModel.deleteMany({}),
    VariantModel.deleteMany({}),
  ]);
});

function buildApp(): Express {
  return createApp({ rateLimitStore: new InMemoryRateLimitStore(), reservationStore: new InMemoryReservationStore(), idempotencyStore: new InMemoryIdempotencyStore() });
}

let phoneCounter = 560000000;

async function createAdminAndLogin(app: Express): Promise<string> {
  phoneCounter += 1;
  const email = `admin-${phoneCounter}@example.com`;
  const password = 'correct-horse-battery-staple';
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'Admin', lastName: 'User', phone: { countryCode: '+971', number: String(phoneCounter) } });
  await UserModel.updateOne({ email }, { role: 'super_admin' });
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
  return loginRes.body.data.accessToken as string;
}

async function createProduct(app: Express, token: string, brandId: string, categoryId: string, overrides: { fabric?: string; title?: string } = {}): Promise<string> {
  const res = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: overrides.title ?? 'Ferozi Lawn',
      articleCode: `KHAS-26-${Math.floor(Math.random() * 1_000_000)}`,
      brandId,
      primaryCategoryId: categoryId,
      categoryIds: [categoryId],
      stitchingType: 'unstitched',
      fabric: overrides.fabric ?? 'lawn',
      season: 'summer',
      colorName: 'Ferozi',
      colorFamily: 'blue_ferozi',
      colorHex: '#1f7a8c',
      basePriceFils: 24_900,
      status: 'active',
    });
  expect(res.status).toBe(201);
  return res.body.data.product.id as string;
}

describe('automated collections (plan.md §7.9)', () => {
  it('resolves productIds live from rules, both publicly and in the admin view', async () => {
    const app = buildApp();
    const token = await createAdminAndLogin(app);
    const brandRes = await request(app).post('/api/v1/admin/brands').set('Authorization', `Bearer ${token}`).send({ name: 'Khaadi', slug: 'khaadi', countryOfOrigin: 'PK' });
    const categoryRes = await request(app).post('/api/v1/admin/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Lawn', slug: 'lawn' });
    const brandId = brandRes.body.data.brand.id as string;
    const categoryId = categoryRes.body.data.category.id as string;

    const lawnProductId = await createProduct(app, token, brandId, categoryId, { fabric: 'lawn', title: 'Lawn Suit' });
    const silkProductId = await createProduct(app, token, brandId, categoryId, { fabric: 'silk', title: 'Silk Suit' });

    const collectionRes = await request(app)
      .post('/api/v1/admin/collections')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'All Lawn',
        slug: 'all-lawn',
        type: 'automated',
        rules: [{ field: 'fabric', operator: 'eq', value: 'lawn' }],
        status: 'active',
      });
    expect(collectionRes.status).toBe(201);
    // The stored doc has no curated `productIds` at all — resolution is live.
    expect(collectionRes.body.data.collection.productIds).toEqual([]);

    const publicRes = await request(app).get('/api/v1/collections/all-lawn');
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.productIds).toEqual([lawnProductId]);
    expect(publicRes.body.data.productIds).not.toContain(silkProductId);

    const adminGetRes = await request(app).get(`/api/v1/admin/collections/${collectionRes.body.data.collection.id}`).set('Authorization', `Bearer ${token}`);
    expect(adminGetRes.body.data.collection.productIds).toEqual([lawnProductId]);

    // Adding a second lawn product picks it up on the next read — no
    // separate "recompute membership" step exists, it's always live.
    const secondLawnProductId = await createProduct(app, token, brandId, categoryId, { fabric: 'lawn', title: 'Another Lawn Suit' });
    const publicResAfter = await request(app).get('/api/v1/collections/all-lawn');
    expect(new Set(publicResAfter.body.data.productIds)).toEqual(new Set([lawnProductId, secondLawnProductId]));
  });

  it('a manual (non-automated) collection still returns its stored, ordered productIds unchanged', async () => {
    const app = buildApp();
    const token = await createAdminAndLogin(app);
    const brandRes = await request(app).post('/api/v1/admin/brands').set('Authorization', `Bearer ${token}`).send({ name: 'Khaadi', slug: 'khaadi', countryOfOrigin: 'PK' });
    const categoryRes = await request(app).post('/api/v1/admin/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Lawn', slug: 'lawn' });
    const productId = await createProduct(app, token, brandRes.body.data.brand.id, categoryRes.body.data.category.id);

    const res = await request(app)
      .post('/api/v1/admin/collections')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Eid Edit', slug: 'eid-edit', type: 'editorial', productIds: [productId], status: 'active' });
    expect(res.status).toBe(201);

    const publicRes = await request(app).get('/api/v1/collections/eid-edit');
    expect(publicRes.body.data.productIds).toEqual([productId]);
  });
});

/**
 * Regression coverage for a real bug found live while wiring the
 * storefront's home page to a CMS `collection_rail` section pointed at a
 * real collection (`docs/implemented-plan.md` §8): `GET /products?collection=`
 * used to filter on `Product.collectionIds`, a denormalized field nothing
 * in this codebase's real collection-curation workflow (this admin
 * endpoint, `Collection.productIds`) ever wrote — so it silently returned
 * zero products for every real manual collection, always. Separately, an
 * unresolvable collection slug silently dropped the filter entirely rather
 * than returning zero results. Both are fixed in
 * `product.service.ts#resolveProductIdsIn`/`collection.service.ts
 * #getCollectionProductIds`.
 */
describe('GET /api/v1/products?collection= (plan.md §9.2)', () => {
  it('returns exactly a manual collection\'s real, curated productIds — not zero, not everything', async () => {
    const app = buildApp();
    const token = await createAdminAndLogin(app);
    const brandRes = await request(app).post('/api/v1/admin/brands').set('Authorization', `Bearer ${token}`).send({ name: 'Khaadi', slug: 'khaadi', countryOfOrigin: 'PK' });
    const categoryRes = await request(app).post('/api/v1/admin/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Lawn', slug: 'lawn' });
    const brandId = brandRes.body.data.brand.id as string;
    const categoryId = categoryRes.body.data.category.id as string;

    const memberProductId = await createProduct(app, token, brandId, categoryId, { title: 'In The Collection' });
    await createProduct(app, token, brandId, categoryId, { title: 'Not In The Collection' });

    const collectionRes = await request(app)
      .post('/api/v1/admin/collections')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Eid Edit', slug: 'eid-edit-real', type: 'editorial', productIds: [memberProductId], status: 'active' });
    expect(collectionRes.status).toBe(201);

    const res = await request(app).get('/api/v1/products?collection=eid-edit-real');
    expect(res.status).toBe(200);
    expect(res.body.data.products.map((p: { id: string }) => p.id)).toEqual([memberProductId]);
  });

  it('returns an automated collection\'s live rule-matched products', async () => {
    const app = buildApp();
    const token = await createAdminAndLogin(app);
    const brandRes = await request(app).post('/api/v1/admin/brands').set('Authorization', `Bearer ${token}`).send({ name: 'Khaadi', slug: 'khaadi', countryOfOrigin: 'PK' });
    const categoryRes = await request(app).post('/api/v1/admin/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Lawn', slug: 'lawn' });
    const brandId = brandRes.body.data.brand.id as string;
    const categoryId = categoryRes.body.data.category.id as string;

    const lawnProductId = await createProduct(app, token, brandId, categoryId, { fabric: 'lawn', title: 'Lawn Suit' });
    await createProduct(app, token, brandId, categoryId, { fabric: 'silk', title: 'Silk Suit' });

    const collectionRes = await request(app)
      .post('/api/v1/admin/collections')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'All Lawn', slug: 'all-lawn-live', type: 'automated', rules: [{ field: 'fabric', operator: 'eq', value: 'lawn' }], status: 'active' });
    expect(collectionRes.status).toBe(201);

    const res = await request(app).get('/api/v1/products?collection=all-lawn-live');
    expect(res.body.data.products.map((p: { id: string }) => p.id)).toEqual([lawnProductId]);
  });

  it('returns zero products for an unresolvable collection slug, never the unfiltered listing', async () => {
    const app = buildApp();
    const token = await createAdminAndLogin(app);
    const brandRes = await request(app).post('/api/v1/admin/brands').set('Authorization', `Bearer ${token}`).send({ name: 'Khaadi', slug: 'khaadi', countryOfOrigin: 'PK' });
    const categoryRes = await request(app).post('/api/v1/admin/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Lawn', slug: 'lawn' });
    await createProduct(app, token, brandRes.body.data.brand.id, categoryRes.body.data.category.id);

    const res = await request(app).get('/api/v1/products?collection=does-not-exist-anywhere');
    expect(res.status).toBe(200);
    expect(res.body.data.products).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });
});
