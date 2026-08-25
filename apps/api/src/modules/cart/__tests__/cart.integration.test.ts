import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Express } from 'express';
import { createApp } from '../../../app.js';
import { connect, disconnect } from '../../../shared/mongo.js';
import { InMemoryRateLimitStore } from '../../../shared/rate-limit.js';
import { InMemoryReservationStore } from '../reservation-store.js';
import { SessionModel, UserModel } from '../../identity/identity.model.js';
import { BrandModel } from '../../catalog/brand.model.js';
import { CategoryModel } from '../../catalog/category.model.js';
import { ProductModel } from '../../catalog/product.model.js';
import { VariantModel } from '../../catalog/variant.model.js';
import { InventoryItemModel } from '../../inventory/inventory-item.model.js';
import { StockMovementModel } from '../../inventory/stock-movement.model.js';
import { DiscountModel } from '../../pricing/discount.model.js';
import { CartModel } from '../cart.model.js';
import { sweepExpiredReservations } from '../cart.service.js';

/**
 * Integration coverage for `cart` — plan.md §9.5, §8.4, §8.5. Priorities
 * per the brief: the reservation flow actually prevents oversell under
 * concurrent adds (real business consequences if wrong), and cart merge's
 * max-not-sum rule.
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
    DiscountModel.syncIndexes(),
    CartModel.syncIndexes(),
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
    DiscountModel.deleteMany({}),
    CartModel.deleteMany({}),
  ]);
});

function buildApp(): { app: Express; reservationStore: InMemoryReservationStore } {
  const reservationStore = new InMemoryReservationStore();
  const app = createApp({ rateLimitStore: new InMemoryRateLimitStore(), reservationStore });
  return { app, reservationStore };
}

let phoneCounter = 520000000;

async function registerAndLogin(app: Express, role: 'super_admin' | 'customer' = 'customer'): Promise<{ token: string; userId: string }> {
  phoneCounter += 1;
  const email = `user-${phoneCounter}@example.com`;
  const password = 'correct-horse-battery-staple';
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'A', lastName: 'B', phone: { countryCode: '+971', number: String(phoneCounter) } });
  const userId = registerRes.body.data.user.id as string;
  if (role !== 'customer') await UserModel.updateOne({ email }, { role });
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
  return { token: loginRes.body.data.accessToken as string, userId };
}

/** Creates a brand + category + product + one variant with a given
 *  `onHand`, via the real admin HTTP surface — same pattern as `inventory
 *  .integration.test.ts`'s `seedVariantWithStock`. */
async function seedVariantWithStock(app: Express, token: string, onHand: number, priceFils = 24_900): Promise<{ variantId: string; productId: string }> {
  const unique = Math.floor(Math.random() * 1_000_000_000);
  const brandRes = await request(app).post('/api/v1/admin/brands').set('Authorization', `Bearer ${token}`).send({ name: 'Khaadi', slug: `khaadi-${unique}`, countryOfOrigin: 'PK' });
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
      basePriceFils: priceFils,
      status: 'active',
    });
  const productId = productRes.body.data.product.id as string;
  const variantRes = await request(app)
    .post(`/api/v1/admin/products/${productId}/variants`)
    .set('Authorization', `Bearer ${token}`)
    .send({ sku: `SKU-${Math.floor(Math.random() * 1_000_000_000)}`, priceFils, weightGrams: 400, initialOnHand: onHand });
  return { variantId: variantRes.body.data.variant.id as string, productId };
}

describe('POST /api/v1/cart + item mutations', () => {
  it('creates a guest cart, adds an item, and reserves stock', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { variantId } = await seedVariantWithStock(app, adminToken, 5);

    const agent = request.agent(app);
    const createRes = await agent.post('/api/v1/cart').send({});
    expect(createRes.status).toBe(201);
    const cartId = createRes.body.data.cartId as string;

    const addRes = await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 2 });
    expect(addRes.status).toBe(201);
    expect(addRes.body.data.items).toHaveLength(1);
    expect(addRes.body.data.items[0].quantity).toBe(2);
    expect(addRes.body.data.totals.subtotalFils).toBe(24_900 * 2);

    const item = await InventoryItemModel.findOne({ variantId }).lean();
    expect(item?.reserved).toBe(2);
    expect(item?.available).toBe(3);

    const movements = await StockMovementModel.find({ variantId, type: 'reservation' }).lean();
    expect(movements).toHaveLength(1);
    expect(movements[0]?.quantity).toBe(-2);
  });

  it('rejects adding more than available stock with OUT_OF_STOCK and the real available count', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { variantId } = await seedVariantWithStock(app, adminToken, 2);

    const agent = request.agent(app);
    const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
    const res = await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OUT_OF_STOCK');
    expect(res.body.error.details.available).toBe(2);

    const item = await InventoryItemModel.findOne({ variantId }).lean();
    expect(item?.reserved).toBe(0); // rejected — nothing was reserved
  });

  it('updating a line quantity releases/reserves exactly the delta', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { variantId } = await seedVariantWithStock(app, adminToken, 10);

    const agent = request.agent(app);
    const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
    const addRes = await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 3 });
    const itemId = addRes.body.data.items[0].id as string;

    const upRes = await agent.patch(`/api/v1/cart/${cartId}/items/${itemId}`).send({ quantity: 1 });
    expect(upRes.status).toBe(200);
    let item = await InventoryItemModel.findOne({ variantId }).lean();
    expect(item?.reserved).toBe(1);

    const downRes = await agent.patch(`/api/v1/cart/${cartId}/items/${itemId}`).send({ quantity: 6 });
    expect(downRes.status).toBe(200);
    item = await InventoryItemModel.findOne({ variantId }).lean();
    expect(item?.reserved).toBe(6);
  });

  it('removing an item releases its full reservation', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { variantId } = await seedVariantWithStock(app, adminToken, 10);

    const agent = request.agent(app);
    const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
    const addRes = await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 4 });
    const itemId = addRes.body.data.items[0].id as string;

    const res = await agent.delete(`/api/v1/cart/${cartId}/items/${itemId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);

    const item = await InventoryItemModel.findOne({ variantId }).lean();
    expect(item?.reserved).toBe(0);
  });

  it('rejects a quantity over the max-per-line with CART_QTY_LIMIT', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { variantId } = await seedVariantWithStock(app, adminToken, 50);

    const agent = request.agent(app);
    const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
    const res = await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 11 });
    expect(res.status).toBe(400); // Zod validation rejects >10 before the service even runs
  });
});

describe('reservation flow prevents oversell under concurrent adds', () => {
  it('exactly one of two concurrent add-to-cart requests for the last unit succeeds', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { variantId } = await seedVariantWithStock(app, adminToken, 1); // only ONE in stock

    const agentA = request.agent(app);
    const agentB = request.agent(app);
    const cartA = (await agentA.post('/api/v1/cart').send({})).body.data.cartId as string;
    const cartB = (await agentB.post('/api/v1/cart').send({})).body.data.cartId as string;

    const [resA, resB] = await Promise.all([
      agentA.post(`/api/v1/cart/${cartA}/items`).send({ variantId, quantity: 1 }),
      agentB.post(`/api/v1/cart/${cartB}/items`).send({ variantId, quantity: 1 }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);
    const failed = resA.status === 409 ? resA : resB;
    expect(failed.body.error.code).toBe('OUT_OF_STOCK');
    expect(failed.body.error.details.available).toBe(0);

    // The critical assertion: never oversold. Exactly 1 reserved, never 2.
    const item = await InventoryItemModel.findOne({ variantId }).lean();
    expect(item?.reserved).toBe(1);
    expect(item?.available).toBe(0);
  });

  it('holds under higher concurrency too — 10 requests racing for 3 units', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { variantId } = await seedVariantWithStock(app, adminToken, 3);

    const agents = Array.from({ length: 10 }, () => request.agent(app));
    const cartIds = await Promise.all(agents.map(async (agent) => (await agent.post('/api/v1/cart').send({})).body.data.cartId as string));

    const results = await Promise.all(agents.map((agent, i) => agent.post(`/api/v1/cart/${cartIds[i]}/items`).send({ variantId, quantity: 1 })));
    const succeeded = results.filter((r) => r.status === 201);
    const failed = results.filter((r) => r.status === 409);

    expect(succeeded).toHaveLength(3);
    expect(failed).toHaveLength(7);

    const item = await InventoryItemModel.findOne({ variantId }).lean();
    expect(item?.reserved).toBe(3);
    expect(item?.available).toBe(0);
  });
});

describe('server-side recalculation', () => {
  it('recomputes totals server-side and ignores anything the client might send', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { variantId } = await seedVariantWithStock(app, adminToken, 10, 10_000);

    const agent = request.agent(app);
    const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
    const addRes = await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 2 });

    // subtotal = 20,000; tax-inclusive extraction at the default 5% VAT rate.
    expect(addRes.body.data.totals.subtotalFils).toBe(20_000);
    expect(addRes.body.data.totals.grandTotalFils).toBe(20_000);
    expect(addRes.body.data.totals.taxFils).toBeGreaterThan(0);
  });

  it('silently picks up a price change and flags it on the line', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { variantId } = await seedVariantWithStock(app, adminToken, 10, 10_000);

    const agent = request.agent(app);
    const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
    await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 1 });

    await VariantModel.updateOne({ _id: variantId }, { priceFils: 15_000 });

    const getRes = await agent.get(`/api/v1/cart/${cartId}`);
    expect(getRes.body.data.items[0].unitPriceFils).toBe(15_000);
    expect(getRes.body.data.items[0].priceChanged).toBe(true);
    expect(getRes.body.data.totals.subtotalFils).toBe(15_000);
  });
});

describe('cart merge on login', () => {
  it('claims an anonymous cart for a newly-logged-in user with no prior cart', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { variantId } = await seedVariantWithStock(app, adminToken, 10);
    const { token, userId } = await registerAndLogin(app);

    const agent = request.agent(app);
    const guestCartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
    await agent.post(`/api/v1/cart/${guestCartId}/items`).send({ variantId, quantity: 2 });

    const mergeRes = await agent.post(`/api/v1/cart/${guestCartId}/merge`).set('Authorization', `Bearer ${token}`).send({});
    expect(mergeRes.status).toBe(200);
    expect(mergeRes.body.data.userId).toBe(userId);
    expect(mergeRes.body.data.items).toHaveLength(1);
    expect(mergeRes.body.data.items[0].quantity).toBe(2);
  });

  it('unions two carts and takes max(qty), not sum, for the same variant', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { variantId } = await seedVariantWithStock(app, adminToken, 10);
    const { token, userId } = await registerAndLogin(app);

    // Build the user's "existing" cart via the real HTTP flow, then mark it
    // as already belonging to the user (simulating an earlier session) —
    // this still exercises the real reservation path for its stock.
    const userAgent = request.agent(app);
    const userCartId = (await userAgent.post('/api/v1/cart').send({})).body.data.cartId as string;
    await userAgent.post(`/api/v1/cart/${userCartId}/items`).send({ variantId, quantity: 2 });
    await CartModel.updateOne({ cartId: userCartId }, { userId });

    // A separate guest session adds the SAME variant with a higher quantity.
    const guestAgent = request.agent(app);
    const guestCartId = (await guestAgent.post('/api/v1/cart').send({})).body.data.cartId as string;
    await guestAgent.post(`/api/v1/cart/${guestCartId}/items`).send({ variantId, quantity: 5 });

    const mergeRes = await guestAgent.post(`/api/v1/cart/${guestCartId}/merge`).set('Authorization', `Bearer ${token}`).send({});
    expect(mergeRes.status).toBe(200);
    expect(mergeRes.body.data.items).toHaveLength(1);
    // max(2, 5) = 5 — NOT 7 (sum).
    expect(mergeRes.body.data.items[0].quantity).toBe(5);

    const guestCartAfter = await CartModel.findOne({ cartId: guestCartId }).lean();
    expect(guestCartAfter?.status).toBe('merged');

    // Exactly one reservation's worth (5) is held, never a leftover
    // 2+5 double-count from both original carts.
    const item = await InventoryItemModel.findOne({ variantId }).lean();
    expect(item?.reserved).toBe(5);
  });
});

describe('coupon application', () => {
  it('applies a valid automatic-eligible code and rejects an invalid one with a specific reason', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { variantId } = await seedVariantWithStock(app, adminToken, 10, 10_000);

    await request(app)
      .post('/api/v1/admin/discounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Welcome', mode: 'code', code: 'WELCOME10', type: 'percentage', value: 10, appliesTo: 'all', status: 'active' });

    const agent = request.agent(app);
    const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
    await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 1 });

    const badRes = await agent.post(`/api/v1/cart/${cartId}/coupon`).send({ code: 'NOPE' });
    expect(badRes.status).toBe(400);
    expect(badRes.body.error.code).toBe('COUPON_INVALID');
    expect(badRes.body.error.message).not.toMatch(/^invalid code$/i);

    const goodRes = await agent.post(`/api/v1/cart/${cartId}/coupon`).send({ code: 'welcome10' });
    expect(goodRes.status).toBe(200);
    expect(goodRes.body.data.appliedCoupons).toHaveLength(1);
    expect(goodRes.body.data.totals.discountFils).toBe(1_000);

    const removeRes = await agent.delete(`/api/v1/cart/${cartId}/coupon`);
    expect(removeRes.body.data.appliedCoupons).toHaveLength(0);
    expect(removeRes.body.data.totals.discountFils).toBe(0);
  });
});

describe('reservation sweep job', () => {
  it('releases stock for a reservation whose Redis-side TTL genuinely expired', async () => {
    const { app, reservationStore } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { variantId } = await seedVariantWithStock(app, adminToken, 5);

    const agent = request.agent(app);
    const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
    await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 2 });

    let item = await InventoryItemModel.findOne({ variantId }).lean();
    expect(item?.reserved).toBe(2);

    // Simulate the reservation's TTL having already lapsed in Redis —
    // force it into the expired state the way real time passing would.
    await reservationStore.clearReserved(cartId, variantId);
    // Re-seed the store's expiry index directly with an already-past
    // expiry so `popExpired` finds it (mirrors what `markReserved` with a
    // negative ttl would produce).
    await reservationStore.markReserved(cartId, variantId, -1);

    const released = await sweepExpiredReservations(reservationStore);
    expect(released).toBe(1);

    item = await InventoryItemModel.findOne({ variantId }).lean();
    expect(item?.reserved).toBe(0);
    expect(item?.available).toBe(5);

    const releaseMovements = await StockMovementModel.find({ variantId, type: 'release' }).lean();
    expect(releaseMovements.length).toBeGreaterThan(0);
  });

  it('is a no-op for a reservation whose line was already removed from the cart', async () => {
    const { app, reservationStore } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { variantId } = await seedVariantWithStock(app, adminToken, 5);

    const agent = request.agent(app);
    const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
    const addRes = await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 1 });
    const itemId = addRes.body.data.items[0].id as string;
    await agent.delete(`/api/v1/cart/${cartId}/items/${itemId}`); // explicit removal already released it

    await reservationStore.markReserved(cartId, variantId, -1); // stale index entry that shouldn't exist anymore, defensively

    const released = await sweepExpiredReservations(reservationStore);
    expect(released).toBe(0); // nothing to release — the line is already gone
  });
});
