import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Express } from 'express';
import { createApp } from '../../../app.js';
import { connect, disconnect } from '../../../shared/mongo.js';
import { InMemoryRateLimitStore } from '../../../shared/rate-limit.js';
import { SessionModel, UserModel } from '../../identity/identity.model.js';
import { BrandModel } from '../../catalog/brand.model.js';
import { CategoryModel } from '../../catalog/category.model.js';
import { ProductModel } from '../../catalog/product.model.js';
import { VariantModel } from '../../catalog/variant.model.js';
import { InventoryItemModel } from '../inventory-item.model.js';
import { StockMovementModel } from '../stock-movement.model.js';

/**
 * Integration coverage for `inventory` — plan.md brief's own priority:
 * "the stock-adjustment endpoint always writes a movement and never bare-
 * sets stock." Every assertion below checks both the HTTP response AND the
 * `stock_movements` collection directly, since the audit trail is the
 * point.
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
    ProductModel.deleteMany({}),
    VariantModel.deleteMany({}),
    InventoryItemModel.deleteMany({}),
    StockMovementModel.deleteMany({}),
  ]);
});

function buildApp(): Express {
  return createApp({ rateLimitStore: new InMemoryRateLimitStore() });
}

let phoneCounter = 510000000;

async function createAdminAndLogin(app: Express, role: 'super_admin' | 'warehouse' | 'customer' = 'super_admin'): Promise<string> {
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

/** Creates a brand + category + product + one variant (with an initial
 *  `onHand`) via the real admin HTTP surface, so the `InventoryItem` this
 *  test adjusts was itself created through `catalog`'s normal variant-
 *  creation flow (`inventory.service.ts#ensureInventoryItem`), not seeded
 *  directly at the data layer. */
async function seedVariantWithStock(app: Express, token: string, onHand = 10): Promise<string> {
  const unique = Math.floor(Math.random() * 1_000_000);
  const brandRes = await request(app)
    .post('/api/v1/admin/brands')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Khaadi', slug: `khaadi-${unique}`, countryOfOrigin: 'PK' });
  const categoryRes = await request(app).post('/api/v1/admin/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Lawn', slug: `lawn-${unique}` });
  const productRes = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: `Ferozi Lawn ${unique}`,
      articleCode: `KHAS-${unique}`,
      brandId: brandRes.body.data.brand.id,
      primaryCategoryId: categoryRes.body.data.category.id,
      stitchingType: 'unstitched',
      fabric: 'lawn',
      season: 'summer',
      colorName: 'Ferozi',
      colorFamily: 'blue_ferozi',
      colorHex: '#1f7a8c',
      basePriceFils: 24_900,
    });
  const productId = productRes.body.data.product.id as string;
  const variantRes = await request(app)
    .post(`/api/v1/admin/products/${productId}/variants`)
    .set('Authorization', `Bearer ${token}`)
    .send({ sku: `SKU-${Math.floor(Math.random() * 1_000_000)}`, priceFils: 24_900, weightGrams: 400, initialOnHand: onHand });
  return variantRes.body.data.variant.id as string;
}

describe('POST /api/v1/admin/inventory/:variantId/adjust', () => {
  it('adjusts onHand and writes a matching StockMovement — never a bare $set', async () => {
    const app = buildApp();
    const token = await createAdminAndLogin(app);
    const variantId = await seedVariantWithStock(app, token, 10);

    const res = await request(app)
      .post(`/api/v1/admin/inventory/${variantId}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 5, type: 'purchase', reason: 'New stock delivery from Khaadi Karachi' });

    expect(res.status).toBe(200);
    expect(res.body.data.item.onHand).toBe(15);
    expect(res.body.data.item.available).toBe(15);
    expect(res.body.data.movement.quantity).toBe(5);
    expect(res.body.data.movement.before).toBe(10);
    expect(res.body.data.movement.after).toBe(15);
    expect(res.body.data.movement.type).toBe('purchase');
    expect(res.body.data.movement.reason).toContain('Khaadi');

    // The audit trail is the point — assert directly against the collection.
    const movements = await StockMovementModel.find({ variantId }).lean();
    expect(movements).toHaveLength(1);
    expect(movements[0]?.before).toBe(10);
    expect(movements[0]?.after).toBe(15);
    expect(movements[0]?.performedBy).toBeDefined();

    const item = await InventoryItemModel.findOne({ variantId }).lean();
    expect(item?.onHand).toBe(15);
  });

  it('propagates the stock delta to the parent product totalStock/inStock', async () => {
    const app = buildApp();
    const token = await createAdminAndLogin(app);
    const variantId = await seedVariantWithStock(app, token, 0);
    const item = await InventoryItemModel.findOne({ variantId }).lean();
    const productId = item?.productId.toString();

    await request(app)
      .post(`/api/v1/admin/inventory/${variantId}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 8, type: 'purchase', reason: 'Initial delivery' });

    const product = await ProductModel.findById(productId).lean();
    expect(product?.totalStock).toBe(8);
    expect(product?.inStock).toBe(true);

    // Now reduce it back to zero — inStock must flip false.
    await request(app)
      .post(`/api/v1/admin/inventory/${variantId}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: -8, type: 'damage', reason: 'Water damage in warehouse' });

    const productAfter = await ProductModel.findById(productId).lean();
    expect(productAfter?.totalStock).toBe(0);
    expect(productAfter?.inStock).toBe(false);
  });

  it('rejects an adjustment that would take onHand negative, and writes no movement', async () => {
    const app = buildApp();
    const token = await createAdminAndLogin(app);
    const variantId = await seedVariantWithStock(app, token, 3);

    const res = await request(app)
      .post(`/api/v1/admin/inventory/${variantId}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: -10, type: 'adjustment', reason: 'Stock count correction' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');

    const movements = await StockMovementModel.find({ variantId }).lean();
    expect(movements).toHaveLength(0);
    const item = await InventoryItemModel.findOne({ variantId }).lean();
    expect(item?.onHand).toBe(3); // unchanged
  });

  it('requires a non-empty reason (VALIDATION_FAILED)', async () => {
    const app = buildApp();
    const token = await createAdminAndLogin(app);
    const variantId = await seedVariantWithStock(app, token, 3);

    const res = await request(app)
      .post(`/api/v1/admin/inventory/${variantId}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 2, type: 'purchase', reason: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('404s for a variant with no inventory record', async () => {
    const app = buildApp();
    const token = await createAdminAndLogin(app);
    const res = await request(app)
      .post('/api/v1/admin/inventory/64b7f7f7f7f7f7f7f7f7f7f7/adjust')
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 1, type: 'purchase', reason: 'test' });
    expect(res.status).toBe(404);
  });

  it('a plain customer cannot adjust stock (403)', async () => {
    const app = buildApp();
    const adminToken = await createAdminAndLogin(app);
    const variantId = await seedVariantWithStock(app, adminToken, 3);
    const customerToken = await createAdminAndLogin(app, 'customer');

    const res = await request(app)
      .post(`/api/v1/admin/inventory/${variantId}/adjust`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ quantity: 1, type: 'purchase', reason: 'test' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/admin/inventory', () => {
  it('filters by lowStock and outOfStock', async () => {
    const app = buildApp();
    const token = await createAdminAndLogin(app);
    const healthyVariant = await seedVariantWithStock(app, token, 20);
    const lowVariant = await seedVariantWithStock(app, token, 2); // default lowStockThreshold is 3
    const outVariant = await seedVariantWithStock(app, token, 0);

    const lowRes = await request(app).get('/api/v1/admin/inventory?lowStock=true').set('Authorization', `Bearer ${token}`);
    const lowIds = lowRes.body.data.items.map((i: { variantId: string }) => i.variantId);
    expect(lowIds).toContain(lowVariant);
    expect(lowIds).not.toContain(healthyVariant);
    expect(lowIds).not.toContain(outVariant);

    const outRes = await request(app).get('/api/v1/admin/inventory?outOfStock=true').set('Authorization', `Bearer ${token}`);
    const outIds = outRes.body.data.items.map((i: { variantId: string }) => i.variantId);
    expect(outIds).toEqual([outVariant]);
  });

  it('lists the full stock-movement history for a variant', async () => {
    const app = buildApp();
    const token = await createAdminAndLogin(app);
    const variantId = await seedVariantWithStock(app, token, 5);

    await request(app).post(`/api/v1/admin/inventory/${variantId}/adjust`).set('Authorization', `Bearer ${token}`).send({ quantity: 3, type: 'purchase', reason: 'a' });
    await request(app).post(`/api/v1/admin/inventory/${variantId}/adjust`).set('Authorization', `Bearer ${token}`).send({ quantity: -2, type: 'damage', reason: 'b' });

    const res = await request(app).get(`/api/v1/admin/inventory/${variantId}/movements`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.movements).toHaveLength(2);
    // Most recent first.
    expect(res.body.data.movements[0].type).toBe('damage');
    expect(res.body.data.movements[1].type).toBe('purchase');
  });
});
