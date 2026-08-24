import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Express } from 'express';
import { createApp } from '../../../app.js';
import { connect, disconnect } from '../../../shared/mongo.js';
import { InMemoryRateLimitStore } from '../../../shared/rate-limit.js';
import { SessionModel, UserModel } from '../../identity/identity.model.js';
import { BrandModel } from '../brand.model.js';
import { CategoryModel } from '../category.model.js';
import { CollectionModel } from '../collection.model.js';
import { ProductModel } from '../product.model.js';
import { VariantModel } from '../variant.model.js';
import { InventoryItemModel } from '../../inventory/inventory-item.model.js';
import { StockMovementModel } from '../../inventory/stock-movement.model.js';

/**
 * Integration coverage for `catalog` — plan.md brief's own priority order:
 * "product listing with facet filters actually filters correctly, the PDP
 * endpoint returns availability correctly." Exercises the real HTTP
 * surface (routes → controllers → services → repositories → Mongoose)
 * against `mongodb-memory-server`, same pattern as `identity`'s
 * `auth.integration.test.ts`.
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
    InventoryItemModel.syncIndexes(),
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
    InventoryItemModel.deleteMany({}),
    StockMovementModel.deleteMany({}),
  ]);
});

function buildApp(): Express {
  return createApp({ rateLimitStore: new InMemoryRateLimitStore() });
}

let phoneCounter = 500000000;

/** Registers a fresh customer, promotes to `super_admin` directly at the
 *  data layer (there is no staff signup flow — same shortcut
 *  `auth.integration.test.ts` uses), and logs in. */
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

interface Fixtures {
  token: string;
  brandId: string;
  categoryId: string;
}

async function seedBrandAndCategory(app: Express): Promise<Fixtures> {
  const token = await createAdminAndLogin(app);
  const brandRes = await request(app)
    .post('/api/v1/admin/brands')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Khaadi', slug: 'khaadi', countryOfOrigin: 'PK' });
  const categoryRes = await request(app)
    .post('/api/v1/admin/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Lawn', slug: 'lawn' });
  return { token, brandId: brandRes.body.data.brand.id as string, categoryId: categoryRes.body.data.category.id as string };
}

interface CreateProductOverrides {
  title?: string;
  stitchingType?: string;
  fabric?: string;
  basePriceFils?: number;
  status?: string;
}

async function createProduct(app: Express, token: string, brandId: string, categoryId: string, overrides: CreateProductOverrides = {}): Promise<string> {
  const res = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: overrides.title ?? 'Ferozi Embroidered Lawn, 3 Piece',
      articleCode: `KHAS-26-${Math.floor(Math.random() * 100000)}`,
      brandId,
      primaryCategoryId: categoryId,
      categoryIds: [categoryId],
      stitchingType: overrides.stitchingType ?? 'unstitched',
      fabric: overrides.fabric ?? 'lawn',
      season: 'summer',
      colorName: 'Ferozi',
      colorFamily: 'blue_ferozi',
      colorHex: '#1f7a8c',
      basePriceFils: overrides.basePriceFils ?? 24_900,
      status: overrides.status ?? 'active',
    });
  expect(res.status).toBe(201);
  return res.body.data.product.id as string;
}

async function addVariant(app: Express, token: string, productId: string, overrides: { size?: string; onHand?: number; priceFils?: number } = {}): Promise<string> {
  const res = await request(app)
    .post(`/api/v1/admin/products/${productId}/variants`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      sku: `SKU-${Math.floor(Math.random() * 1_000_000)}`,
      options: overrides.size ? { size: overrides.size } : {},
      priceFils: overrides.priceFils ?? 24_900,
      weightGrams: 400,
      initialOnHand: overrides.onHand ?? 5,
    });
  expect(res.status).toBe(201);
  return res.body.data.variant.id as string;
}

describe('GET /api/v1/products — facet filters', () => {
  it('filters by stitchingType, fabric, price range, inStock and size', async () => {
    const app = buildApp();
    const { token, brandId, categoryId } = await seedBrandAndCategory(app);

    const unstitchedLawn = await createProduct(app, token, brandId, categoryId, {
      title: 'Ferozi Embroidered Lawn, 3 Piece',
      stitchingType: 'unstitched',
      fabric: 'lawn',
      basePriceFils: 20_000,
    });
    await addVariant(app, token, unstitchedLawn, { size: 'M', onHand: 5 });

    const pretSilk = await createProduct(app, token, brandId, categoryId, {
      title: 'Noir Organza Gharara Set',
      stitchingType: 'pret',
      fabric: 'silk',
      basePriceFils: 80_000,
    });
    await addVariant(app, token, pretSilk, { size: 'L', onHand: 0 }); // out of stock — never adjusted up

    // stitchingType filter
    const byStitching = await request(app).get('/api/v1/products?stitchingType=pret');
    expect(byStitching.status).toBe(200);
    expect(byStitching.body.data.products).toHaveLength(1);
    expect(byStitching.body.data.products[0].id).toBe(pretSilk);

    // fabric filter
    const byFabric = await request(app).get('/api/v1/products?fabric=lawn');
    expect(byFabric.body.data.products).toHaveLength(1);
    expect(byFabric.body.data.products[0].id).toBe(unstitchedLawn);

    // price range filter — only the cheaper product falls in [10000,30000]
    const byPrice = await request(app).get('/api/v1/products?minPrice=10000&maxPrice=30000');
    expect(byPrice.body.data.products).toHaveLength(1);
    expect(byPrice.body.data.products[0].id).toBe(unstitchedLawn);

    // inStock filter — only the lawn product has any available stock
    const inStockOnly = await request(app).get('/api/v1/products?inStock=true');
    expect(inStockOnly.body.data.products.map((p: { id: string }) => p.id)).toEqual([unstitchedLawn]);

    // size filter — only the lawn product has an 'M' variant
    const bySize = await request(app).get('/api/v1/products?size=M');
    expect(bySize.body.data.products).toHaveLength(1);
    expect(bySize.body.data.products[0].id).toBe(unstitchedLawn);

    // combining an unmatched filter yields zero results, not an error
    const noMatch = await request(app).get('/api/v1/products?stitchingType=pret&fabric=lawn');
    expect(noMatch.status).toBe(200);
    expect(noMatch.body.data.products).toHaveLength(0);
  });

  it('never returns a draft product on the public listing', async () => {
    const app = buildApp();
    const { token, brandId, categoryId } = await seedBrandAndCategory(app);
    await createProduct(app, token, brandId, categoryId, { status: 'draft' });

    const res = await request(app).get('/api/v1/products');
    expect(res.body.data.products).toHaveLength(0);
  });
});

describe('GET /api/v1/products/:slug — PDP payload', () => {
  it('returns product + variants with live availability + brand + breadcrumbs', async () => {
    const app = buildApp();
    const { token, brandId, categoryId } = await seedBrandAndCategory(app);
    const productId = await createProduct(app, token, brandId, categoryId);
    await addVariant(app, token, productId, { size: 'M', onHand: 7 });
    await addVariant(app, token, productId, { size: 'L', onHand: 0 });

    const slugRes = await request(app).get(`/api/v1/admin/products/${productId}`).set('Authorization', `Bearer ${token}`);
    const slug = slugRes.body.data.product.slug as string;

    const res = await request(app).get(`/api/v1/products/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.product.id).toBe(productId);
    expect(res.body.data.brand.id).toBe(brandId);
    expect(res.body.data.variants).toHaveLength(2);

    const sizeM = res.body.data.variants.find((v: { options: { size?: string } }) => v.options.size === 'M');
    const sizeL = res.body.data.variants.find((v: { options: { size?: string } }) => v.options.size === 'L');
    expect(sizeM.available).toBe(7);
    expect(sizeL.available).toBe(0);
    expect(sizeM.allowBackorder).toBe(false);

    expect(res.body.data.breadcrumbs).toEqual([{ name: 'Lawn', slug: 'lawn' }]);

    // Product-level totalStock/inStock reflect the sum across variants —
    // the inventory→catalog stock-propagation path (plan.md brief).
    expect(res.body.data.product.totalStock).toBe(7);
    expect(res.body.data.product.inStock).toBe(true);
  });

  it('404s for an unknown or unpublished slug', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/products/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/v1/categories/tree', () => {
  it('nests categories by parentId', async () => {
    const app = buildApp();
    const token = await createAdminAndLogin(app);
    const parentRes = await request(app).post('/api/v1/admin/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Unstitched', slug: 'unstitched' });
    const parentId = parentRes.body.data.category.id as string;
    await request(app).post('/api/v1/admin/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Lawn', slug: 'lawn', parentId });

    const res = await request(app).get('/api/v1/categories/tree');
    expect(res.status).toBe(200);
    expect(res.body.data.categories).toHaveLength(1);
    expect(res.body.data.categories[0].slug).toBe('unstitched');
    expect(res.body.data.categories[0].children).toHaveLength(1);
    expect(res.body.data.categories[0].children[0].slug).toBe('lawn');
    expect(res.body.data.categories[0].children[0].path).toBe('unstitched/lawn');
  });
});

describe('admin RBAC on catalog routes (plan.md §10.2)', () => {
  it('forbids a plain customer from creating a brand', async () => {
    const app = buildApp();
    const email = 'customer@example.com';
    const password = 'correct-horse-battery-staple';
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password, firstName: 'A', lastName: 'B', phone: { countryCode: '+971', number: '509999999' } });
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
    const token = loginRes.body.data.accessToken as string;

    const res = await request(app).post('/api/v1/admin/brands').set('Authorization', `Bearer ${token}`).send({ name: 'X', slug: 'x', countryOfOrigin: 'PK' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTH_FORBIDDEN');
  });
});
