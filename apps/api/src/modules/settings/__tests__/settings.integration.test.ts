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
import { BrandModel } from '../../catalog/brand.model.js';
import { CategoryModel } from '../../catalog/category.model.js';
import { ProductModel } from '../../catalog/product.model.js';
import { VariantModel } from '../../catalog/variant.model.js';
import { InventoryItemModel } from '../../inventory/inventory-item.model.js';
import { CartModel } from '../../cart/cart.model.js';
import { CheckoutSessionModel } from '../../checkout/checkout.model.js';
import { SettingsModel } from '../settings.model.js';
import { env } from '../../../shared/env.js';
import { STANDARD_SHIPPING_FEE_FILS } from '../../../config/constants.js';

/**
 * Integration coverage for `/admin/settings` (plan.md §9.7/§11.1) — RBAC,
 * the "seed once from today's hardcoded values" contract, the
 * masked/computed payment-gateway status, and — the priority the brief
 * called out explicitly — that `cart`/`checkout` actually READ this
 * module's values at runtime rather than merely typechecking against them.
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
    CartModel.syncIndexes(),
    CheckoutSessionModel.syncIndexes(),
    SettingsModel.syncIndexes(),
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
    CartModel.deleteMany({}),
    CheckoutSessionModel.deleteMany({}),
    SettingsModel.deleteMany({}),
  ]);
});

function buildApp(): Express {
  return createApp({ rateLimitStore: new InMemoryRateLimitStore(), reservationStore: new InMemoryReservationStore(), idempotencyStore: new InMemoryIdempotencyStore() });
}

let phoneCounter = 550000000;

async function registerAndLogin(app: Express, role: 'super_admin' | 'customer' = 'super_admin'): Promise<string> {
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

async function seedVariantWithStock(app: Express, token: string, onHand: number, priceFils = 24_900): Promise<{ variantId: string }> {
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
  return { variantId: variantRes.body.data.variant.id as string };
}

function inlineShippingAddress(emirate = 'dubai') {
  return {
    shipping: {
      inline: {
        firstName: 'Sara',
        lastName: 'Khan',
        phone: { countryCode: '+971', number: '501234567' },
        emirate,
        city: 'Dubai',
        area: 'Al Barsha',
        buildingName: 'Building 12',
        landmark: 'Near Mall of the Emirates',
      },
    },
    billingSameAsShipping: true,
  };
}

describe('GET /api/v1/admin/settings', () => {
  it('a plain customer cannot read settings (403)', async () => {
    const app = buildApp();
    const token = await registerAndLogin(app, 'customer');
    const res = await request(app).get('/api/v1/admin/settings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('requires authentication (401)', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/admin/settings');
    expect(res.status).toBe(401);
  });

  it('seeds defaults on first read that exactly match the values that used to be hardcoded constants', async () => {
    const app = buildApp();
    const token = await registerAndLogin(app);
    const res = await request(app).get('/api/v1/admin/settings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const { settings } = res.body.data;

    expect(settings.taxRate).toBe(env.VAT_RATE);
    expect(settings.cod.feeFils).toBe(env.COD_FEE_FILS);
    expect(settings.cod.maxOrderFils).toBe(env.COD_MAX_ORDER_FILS);
    expect(settings.shipping.freeShippingThresholdFils).toBe(env.FREE_SHIPPING_THRESHOLD_FILS);
    expect(settings.shipping.rates).toHaveLength(7); // all 7 emirates
    for (const rate of settings.shipping.rates) {
      expect(rate.feeFils).toBe(STANDARD_SHIPPING_FEE_FILS);
    }
    const dubai = settings.shipping.rates.find((r: { emirate: string }) => r.emirate === 'dubai');
    expect(dubai).toMatchObject({ etaMinDays: 1, etaMaxDays: 3 });
    expect(settings.maintenanceMode).toBe(false);
    expect(settings.featureFlags).toEqual({});

    // A second read must not re-seed/drift — same singleton document.
    const res2 = await request(app).get('/api/v1/admin/settings').set('Authorization', `Bearer ${token}`);
    expect(res2.body.data.settings.taxRate).toBe(settings.taxRate);
    expect(await SettingsModel.countDocuments({})).toBe(1);
  });

  it('exposes a masked, computed payment-gateway status — never a raw key', async () => {
    const app = buildApp();
    const token = await registerAndLogin(app);
    const res = await request(app).get('/api/v1/admin/settings').set('Authorization', `Bearer ${token}`);
    expect(res.body.data.settings.paymentGateway).toEqual({
      provider: 'ziina',
      apiKeyConfigured: Boolean(env.ZIINA_API_KEY),
      webhookSecretConfigured: Boolean(env.ZIINA_WEBHOOK_SECRET),
    });
  });
});

describe('PATCH /api/v1/admin/settings', () => {
  it('a plain customer cannot write settings (403)', async () => {
    const app = buildApp();
    const token = await registerAndLogin(app, 'customer');
    const res = await request(app).patch('/api/v1/admin/settings').set('Authorization', `Bearer ${token}`).send({ taxRate: 0.1 });
    expect(res.status).toBe(403);
  });

  it('updates fields and persists them, leaving unspecified fields untouched', async () => {
    const app = buildApp();
    const token = await registerAndLogin(app);
    await request(app).get('/api/v1/admin/settings').set('Authorization', `Bearer ${token}`); // seed first

    const patchRes = await request(app)
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ taxRate: 0.08, maintenanceMode: true, featureFlags: { newCheckout: true } });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.settings.taxRate).toBe(0.08);
    expect(patchRes.body.data.settings.maintenanceMode).toBe(true);
    expect(patchRes.body.data.settings.featureFlags).toEqual({ newCheckout: true });
    // Untouched field still has its seeded default.
    expect(patchRes.body.data.settings.cod.feeFils).toBe(env.COD_FEE_FILS);

    const getRes = await request(app).get('/api/v1/admin/settings').set('Authorization', `Bearer ${token}`);
    expect(getRes.body.data.settings.taxRate).toBe(0.08);
  });

  it('works as the very first request — PATCH before any GET still seeds then updates', async () => {
    const app = buildApp();
    const token = await registerAndLogin(app);
    const res = await request(app).patch('/api/v1/admin/settings').set('Authorization', `Bearer ${token}`).send({ cod: { feeFils: 1_500, maxOrderFils: 100_000 } });
    expect(res.status).toBe(200);
    expect(res.body.data.settings.cod).toEqual({ feeFils: 1_500, maxOrderFils: 100_000 });
    expect(await SettingsModel.countDocuments({})).toBe(1);
  });

  it('silently ignores a client-supplied paymentGateway — never persisted, never able to influence the computed status', async () => {
    const app = buildApp();
    const token = await registerAndLogin(app);
    const res = await request(app)
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ taxRate: 0.05, paymentGateway: { provider: 'ziina', apiKeyConfigured: true, webhookSecretConfigured: true, secretKey: 'sk_live_should_never_be_accepted' } });
    expect(res.status).toBe(200);
    expect(res.body.data.settings.paymentGateway).toEqual({
      provider: 'ziina',
      apiKeyConfigured: Boolean(env.ZIINA_API_KEY),
      webhookSecretConfigured: Boolean(env.ZIINA_WEBHOOK_SECRET),
    });
    const raw = await SettingsModel.findOne({}).lean();
    expect(raw).not.toHaveProperty('paymentGateway');
  });
});

describe('cross-module wiring — cart/checkout actually read settings at runtime, not just at typecheck time', () => {
  it('a PATCHed taxRate changes what the cart computes as tax on the very next read', async () => {
    const app = buildApp();
    const adminToken = await registerAndLogin(app, 'super_admin');
    const { variantId } = await seedVariantWithStock(app, adminToken, 10, 100_000); // AED 1000, well under free-shipping/COD caps

    const agent = request.agent(app);
    const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
    await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 1 });
    const beforeRes = await agent.get(`/api/v1/cart/${cartId}`);
    const taxBefore = beforeRes.body.data.totals.taxFils as number;
    expect(taxBefore).toBeGreaterThan(0);
    // Default 5% VAT, tax-inclusive: 100000 - 100000/1.05 = 4762 (rounded).
    expect(taxBefore).toBe(Math.round(100_000 - 100_000 / 1.05));

    const patchRes = await request(app).patch('/api/v1/admin/settings').set('Authorization', `Bearer ${adminToken}`).send({ taxRate: 0.1 });
    expect(patchRes.status).toBe(200);

    const afterRes = await agent.get(`/api/v1/cart/${cartId}`);
    const taxAfter = afterRes.body.data.totals.taxFils as number;
    expect(taxAfter).toBe(Math.round(100_000 - 100_000 / 1.1));
    expect(taxAfter).not.toBe(taxBefore);
  });

  it('a PATCHed shipping rate changes the flat-rate quote checkout returns for that emirate', async () => {
    const app = buildApp();
    const adminToken = await registerAndLogin(app, 'super_admin');
    // Deliberately below the (default) free-shipping threshold so the fee is non-zero.
    const { variantId } = await seedVariantWithStock(app, adminToken, 10, 5_000);

    // Seed, then raise Dubai's fee and lower the free-shipping threshold's
    // irrelevance here (subtotal 5,000 stays under it either way) while
    // keeping every other emirate's row as the seeded default — proves a
    // per-emirate edit, not a global one.
    const seeded = (await request(app).get('/api/v1/admin/settings').set('Authorization', `Bearer ${adminToken}`)).body.data.settings;
    const newRates = seeded.shipping.rates.map((r: { emirate: string; feeFils: number; etaMinDays: number; etaMaxDays: number }) =>
      r.emirate === 'dubai' ? { ...r, feeFils: 9_999 } : r,
    );
    await request(app)
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ shipping: { rates: newRates, freeShippingThresholdFils: seeded.shipping.freeShippingThresholdFils } });

    const agent = request.agent(app);
    const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
    await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 1 });
    const sessionRes = await agent.post('/api/v1/checkout/session').send({ cartId, guestEmail: 'shopper@example.com' });
    const sessionId = sessionRes.body.data.sessionId as string;
    await agent.post(`/api/v1/checkout/session/${sessionId}/address`).send(inlineShippingAddress('dubai'));
    const shipRes = await agent.post(`/api/v1/checkout/session/${sessionId}/shipping`).send({});

    expect(shipRes.status).toBe(200);
    expect(shipRes.body.data.shippingMethod.priceFils).toBe(9_999);
  });

  it('a PATCHed COD max-order cap is enforced by checkout immediately', async () => {
    const app = buildApp();
    const adminToken = await registerAndLogin(app, 'super_admin');
    const { variantId } = await seedVariantWithStock(app, adminToken, 10, 50_000); // under the DEFAULT cap, over a lowered one

    await request(app).patch('/api/v1/admin/settings').set('Authorization', `Bearer ${adminToken}`).send({ cod: { feeFils: env.COD_FEE_FILS, maxOrderFils: 10_000 } });

    const agent = request.agent(app);
    const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
    await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 1 });
    const sessionRes = await agent.post('/api/v1/checkout/session').send({ cartId, guestEmail: 'shopper@example.com' });
    const sessionId = sessionRes.body.data.sessionId as string;
    await agent.post(`/api/v1/checkout/session/${sessionId}/address`).send(inlineShippingAddress('dubai'));
    await agent.post(`/api/v1/checkout/session/${sessionId}/shipping`).send({});

    const intentRes = await agent.post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'cod' });
    expect(intentRes.status).toBe(409);
    expect(intentRes.body.error.code).toBe('COD_LIMIT_EXCEEDED');
    expect(intentRes.body.error.details.maxFils).toBe(10_000);
  });
});
