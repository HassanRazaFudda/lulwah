import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Express } from 'express';
import { randomInt } from 'node:crypto';
import { createApp } from '../../../app.js';
import { connect, disconnect } from '../../../shared/mongo.js';
import { InMemoryRateLimitStore } from '../../../shared/rate-limit.js';
import { InMemoryReservationStore } from '../../cart/reservation-store.js';
import { InMemoryIdempotencyStore } from '../../checkout/idempotency-store.js';
import { SessionModel, UserModel } from '../../identity/identity.model.js';
import { AddressModel } from '../../identity/address.model.js';
import { BrandModel } from '../../catalog/brand.model.js';
import { CategoryModel } from '../../catalog/category.model.js';
import { ProductModel } from '../../catalog/product.model.js';
import { VariantModel } from '../../catalog/variant.model.js';
import { InventoryItemModel } from '../../inventory/inventory-item.model.js';
import { StockMovementModel } from '../../inventory/stock-movement.model.js';
import { DiscountModel } from '../../pricing/discount.model.js';
import { CartModel } from '../../cart/cart.model.js';
import { CheckoutSessionModel } from '../../checkout/checkout.model.js';
import { CodOtpModel } from '../../payment/cod-otp.model.js';
import { WebhookEventModel } from '../../payment/webhook-event.model.js';
import { OrderModel, CounterModel } from '../../order/order.model.js';

/**
 * Integration coverage for `/admin/customers*` — plan.md §11.1. Priorities:
 * the module-boundary composition actually works end to end (real
 * order/cart data merged onto a real `identity` profile, not a mock), RBAC
 * (`customers.read`/`write`, re-checked both at the route and inside
 * `identity.service.ts`), the "customer" surface never leaks a staff
 * account (404, not a staff profile), and that `notesInternal`/tags write
 * correctly via `PATCH`.
 *
 * Building a *real* order to assert spend/order-count/COD-risk against
 * means driving the actual COD checkout flow (same fixtures
 * `checkout.integration.test.ts` uses) rather than hand-rolling an
 * `OrderModel.create()` fixture that could silently drift from what the
 * real flow actually produces.
 */
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, randomInt: vi.fn(actual.randomInt) };
});
const mockedRandomInt = vi.mocked(randomInt);
function pinNextOtp(code: number): void {
  mockedRandomInt.mockReturnValueOnce(code);
}

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connect(mongo.getUri());
  await Promise.all([
    UserModel.syncIndexes(),
    SessionModel.syncIndexes(),
    AddressModel.syncIndexes(),
    BrandModel.syncIndexes(),
    CategoryModel.syncIndexes(),
    ProductModel.syncIndexes(),
    VariantModel.syncIndexes(),
    InventoryItemModel.syncIndexes(),
    DiscountModel.syncIndexes(),
    CartModel.syncIndexes(),
    CheckoutSessionModel.syncIndexes(),
    CodOtpModel.syncIndexes(),
    WebhookEventModel.syncIndexes(),
    OrderModel.syncIndexes(),
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
    AddressModel.deleteMany({}),
    BrandModel.deleteMany({}),
    CategoryModel.deleteMany({}),
    ProductModel.deleteMany({}),
    VariantModel.deleteMany({}),
    InventoryItemModel.deleteMany({}),
    StockMovementModel.deleteMany({}),
    DiscountModel.deleteMany({}),
    CartModel.deleteMany({}),
    CheckoutSessionModel.deleteMany({}),
    CodOtpModel.deleteMany({}),
    WebhookEventModel.deleteMany({}),
    OrderModel.deleteMany({}),
    CounterModel.deleteMany({}),
  ]);
});

function buildApp(): Express {
  return createApp({ rateLimitStore: new InMemoryRateLimitStore(), reservationStore: new InMemoryReservationStore(), idempotencyStore: new InMemoryIdempotencyStore() });
}

let phoneCounter = 540000000;

async function registerAndLogin(app: Express, role: 'super_admin' | 'customer' | 'support' = 'customer'): Promise<{ token: string; userId: string; email: string }> {
  phoneCounter += 1;
  const email = `user-${phoneCounter}@example.com`;
  const password = 'correct-horse-battery-staple';
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'Fatima', lastName: 'Al Marzooqi', phone: { countryCode: '+971', number: String(phoneCounter) } });
  const userId = registerRes.body.data.user.id as string;
  if (role !== 'customer') await UserModel.updateOne({ email }, { role });
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
  return { token: loginRes.body.data.accessToken as string, userId, email };
}

async function seedVariantWithStock(app: Express, adminToken: string, onHand: number, priceFils = 24_900): Promise<{ variantId: string; productId: string }> {
  const unique = Math.floor(Math.random() * 1_000_000_000);
  const brandRes = await request(app).post('/api/v1/admin/brands').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Khaadi', slug: `khaadi-${unique}`, countryOfOrigin: 'PK' });
  const categoryRes = await request(app).post('/api/v1/admin/categories').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Lawn', slug: `lawn-${unique}` });
  const productRes = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
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
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ sku: `SKU-${Math.floor(Math.random() * 1_000_000_000)}`, priceFils, weightGrams: 400, initialOnHand: onHand });
  return { variantId: variantRes.body.data.variant.id as string, productId };
}

function inlineShippingAddress() {
  return {
    shipping: {
      inline: {
        firstName: 'Sara',
        lastName: 'Khan',
        phone: { countryCode: '+971', number: '501234567' },
        emirate: 'dubai',
        city: 'Dubai',
        area: 'Al Barsha',
        buildingName: 'Building 12',
        landmark: 'Near Mall of the Emirates',
      },
    },
    billingSameAsShipping: true,
  };
}

/**
 * Drives a real guest COD checkout to completion (same shape
 * `checkout.integration.test.ts` uses) and returns the placed order's id/
 * total. `checkout`'s routes never actually attach a logged-in customer's
 * identity to the order in this codebase today (its routes carry no auth
 * middleware to populate `req.user` — a real, separate gap outside this
 * module's scope, noted in this module's own report). Attaching the order
 * to a specific customer for a test's purposes is therefore done with one
 * direct, clearly-labelled `OrderModel` write after a real placement, not
 * by hand-rolling the whole order document.
 */
async function placeCodOrderForCustomer(app: Express, adminToken: string, customerId: string, otpCode: number, priceFils = 24_900, quantity = 2): Promise<{ orderId: string; orderNumber: string; grandTotalFils: number }> {
  const { variantId } = await seedVariantWithStock(app, adminToken, 10, priceFils);
  const agent = request.agent(app);
  const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
  await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity });

  const sessionRes = await agent.post('/api/v1/checkout/session').send({ cartId, guestEmail: 'shopper@example.com' });
  const sessionId = sessionRes.body.data.sessionId as string;
  await agent.post(`/api/v1/checkout/session/${sessionId}/address`).send(inlineShippingAddress());
  await agent.post(`/api/v1/checkout/session/${sessionId}/shipping`).send({});

  pinNextOtp(otpCode);
  await request(app).post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'cod' });
  await request(app)
    .post('/api/v1/checkout/cod/verify-otp')
    .send({ sessionId, code: String(otpCode) });

  const placeRes = await request(app)
    .post(`/api/v1/checkout/session/${sessionId}/place`)
    .set('Idempotency-Key', `order-key-${otpCode}`)
    .send({});
  const orderId = placeRes.body.data.order.id as string;
  const orderNumber = placeRes.body.data.order.orderNumber as string;
  const grandTotalFils = placeRes.body.data.order.grandTotalFils as number;

  await OrderModel.updateOne({ _id: orderId }, { userId: customerId });
  return { orderId, orderNumber, grandTotalFils };
}

describe('RBAC — /api/v1/admin/customers*', () => {
  it('requires authentication', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/admin/customers');
    expect(res.status).toBe(401);
  });

  it('a plain customer (no customers.read) is forbidden', async () => {
    const app = buildApp();
    const { token } = await registerAndLogin(app, 'customer');
    const res = await request(app).get('/api/v1/admin/customers').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('support (customers.read + customers.write per plan.md §10.2) can list and write', async () => {
    const app = buildApp();
    const { token } = await registerAndLogin(app, 'support');
    const { userId: targetId } = await registerAndLogin(app, 'customer');
    const listRes = await request(app).get('/api/v1/admin/customers').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    const patchRes = await request(app).patch(`/api/v1/admin/customers/${targetId}`).set('Authorization', `Bearer ${token}`).send({ tags: ['vip'] });
    expect(patchRes.status).toBe(200);
  });
});

describe('GET /api/v1/admin/customers', () => {
  it('lists only role:customer accounts, with live (zero) spend/order stats for a customer with no orders', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { userId: customerId, email } = await registerAndLogin(app, 'customer');

    const res = await request(app).get('/api/v1/admin/customers').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const found = res.body.data.customers.find((c: { id: string }) => c.id === customerId);
    expect(found).toBeDefined();
    expect(found.email).toBe(email);
    expect(found.notesInternal).toBe('');
    expect(found.stats).toEqual({ orderCount: 0, totalSpentFils: 0, avgOrderValueFils: 0, lastOrderAt: null });

    // The admin account itself (role: super_admin) must never appear on
    // the Customers screen.
    const adminOnList = res.body.data.customers.find((c: { email: string }) => c.email !== email);
    expect(adminOnList).toBeUndefined();
  });

  it('search matches name/email, tag filters exactly, marketingConsent filters by opt-in', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { userId: idA, email: emailA } = await registerAndLogin(app, 'customer');
    const { userId: idB } = await registerAndLogin(app, 'customer');

    await UserModel.updateOne({ _id: idA }, { tags: ['vip'], marketing: { email: true, sms: false, whatsapp: false, consentAt: new Date(), consentIp: '1.2.3.4' } });
    await UserModel.updateOne({ _id: idB }, { tags: ['wholesale'] });

    const bySearch = await request(app).get(`/api/v1/admin/customers?search=${encodeURIComponent(emailA)}`).set('Authorization', `Bearer ${adminToken}`);
    expect(bySearch.body.data.customers.map((c: { id: string }) => c.id)).toEqual([idA]);

    const byTag = await request(app).get('/api/v1/admin/customers?tag=wholesale').set('Authorization', `Bearer ${adminToken}`);
    expect(byTag.body.data.customers.map((c: { id: string }) => c.id)).toEqual([idB]);

    const byConsent = await request(app).get('/api/v1/admin/customers?marketingConsent=true').set('Authorization', `Bearer ${adminToken}`);
    expect(byConsent.body.data.customers.map((c: { id: string }) => c.id)).toEqual([idA]);
  });

  it('sort=spend orders customers by real order value, highest first', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { userId: bigSpender } = await registerAndLogin(app, 'customer');
    const { userId: smallSpender } = await registerAndLogin(app, 'customer');

    await placeCodOrderForCustomer(app, adminToken, smallSpender, 111111, 10_000, 1);
    // Stays comfortably under the real COD_MAX_ORDER_FILS cap (AED 2,000 /
    // 200,000 fils, per `env.ts`/`payment.service.ts`) while still clearly
    // larger than `smallSpender`'s order.
    await placeCodOrderForCustomer(app, adminToken, bigSpender, 222222, 40_000, 2);

    const res = await request(app).get('/api/v1/admin/customers?sort=spend').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.customers.map((c: { id: string }) => c.id);
    expect(ids.indexOf(bigSpender)).toBeLessThan(ids.indexOf(smallSpender));
    const bigSpenderRow = res.body.data.customers.find((c: { id: string }) => c.id === bigSpender);
    expect(bigSpenderRow.stats.totalSpentFils).toBeGreaterThan(0);
    expect(bigSpenderRow.stats.orderCount).toBe(1);
  });
});

describe('GET /api/v1/admin/customers/:id', () => {
  it('composes profile + addresses + order history + current cart + COD risk from real cross-module data', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { token: customerToken, userId: customerId } = await registerAndLogin(app, 'customer');

    // Address book — real `identity/address.service.ts#listAddresses`.
    await request(app)
      .post('/api/v1/me/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        firstName: 'Fatima',
        lastName: 'Al Marzooqi',
        phone: { countryCode: '+971', number: '501234567' },
        emirate: 'dubai',
        city: 'Dubai',
        area: 'Al Barsha',
        buildingName: 'Marina Heights',
        landmark: 'Near Mall of the Emirates',
      });

    // Order history + spend — a real placed COD order attributed to this customer.
    const { orderId, grandTotalFils } = await placeCodOrderForCustomer(app, adminToken, customerId, 482913, 24_900, 2);

    // A live, uncoverted cart — real `cart` module data via the real merge-on-login endpoint.
    const { variantId } = await seedVariantWithStock(app, adminToken, 5, 15_000);
    const cartId = (await request(app).post('/api/v1/cart').send({})).body.data.cartId as string;
    await request(app).post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 1 });
    await request(app).post(`/api/v1/cart/${cartId}/merge`).set('Authorization', `Bearer ${customerToken}`);

    const res = await request(app).get(`/api/v1/admin/customers/${customerId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { customer, addresses, orders, ordersTotal, currentCart, codRisk } = res.body.data;

    expect(customer.id).toBe(customerId);
    expect(customer.stats.orderCount).toBe(1);
    expect(customer.stats.totalSpentFils).toBe(grandTotalFils);
    expect(customer.stats.lastOrderAt).not.toBeNull();

    expect(addresses).toHaveLength(1);
    expect(addresses[0].area).toBe('Al Barsha');

    expect(ordersTotal).toBe(1);
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe(orderId);

    expect(currentCart).not.toBeNull();
    expect(currentCart.items).toHaveLength(1);
    expect(currentCart.items[0].variantId).toBe(variantId);

    expect(codRisk).toEqual({ taggedRisky: false, codOrdersPlaced: 1, codOrdersCancelled: 0, cancelledRate: 0 });
  });

  it('a customer with no cart gets currentCart: null, not an error', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { userId: customerId } = await registerAndLogin(app, 'customer');

    const res = await request(app).get(`/api/v1/admin/customers/${customerId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.currentCart).toBeNull();
    expect(res.body.data.codRisk).toEqual({ taggedRisky: false, codOrdersPlaced: 0, codOrdersCancelled: 0, cancelledRate: 0 });
  });

  it('404s for an id that is a real user but not role:customer (never leaks a staff profile through this surface)', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { userId: staffId } = await registerAndLogin(app, 'support');

    const res = await request(app).get(`/api/v1/admin/customers/${staffId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('404s for a well-formed id that does not exist', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const res = await request(app).get('/api/v1/admin/customers/000000000000000000000000').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('reflects the risky_cod tag and a cancelled COD order in codRisk', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { userId: customerId } = await registerAndLogin(app, 'customer');
    await UserModel.updateOne({ _id: customerId }, { tags: ['risky_cod'] });

    const { orderId } = await placeCodOrderForCustomer(app, adminToken, customerId, 999111, 24_900, 1);
    await request(app).patch(`/api/v1/admin/orders/${orderId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'cancelled', note: 'Customer refused delivery.' });

    const res = await request(app).get(`/api/v1/admin/customers/${customerId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.codRisk).toEqual({ taggedRisky: true, codOrdersPlaced: 1, codOrdersCancelled: 1, cancelledRate: 1 });
    // A cancelled order no longer counts toward spend/order-count.
    expect(res.body.data.customer.stats.orderCount).toBe(0);
    expect(res.body.data.customer.stats.totalSpentFils).toBe(0);
  });
});

describe('PATCH /api/v1/admin/customers/:id', () => {
  it('replaces tags and notesInternal, and the change persists on a later GET', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { userId: customerId } = await registerAndLogin(app, 'customer');

    const patchRes = await request(app)
      .patch(`/api/v1/admin/customers/${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tags: ['vip', 'wholesale'], notesInternal: 'Prefers WhatsApp contact.' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.customer.tags).toEqual(['vip', 'wholesale']);
    expect(patchRes.body.data.customer.notesInternal).toBe('Prefers WhatsApp contact.');

    const getRes = await request(app).get(`/api/v1/admin/customers/${customerId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.body.data.customer.tags).toEqual(['vip', 'wholesale']);
    expect(getRes.body.data.customer.notesInternal).toBe('Prefers WhatsApp contact.');
  });

  it('updating only notesInternal leaves existing tags untouched (a partial write, not a reset)', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { userId: customerId } = await registerAndLogin(app, 'customer');
    await request(app).patch(`/api/v1/admin/customers/${customerId}`).set('Authorization', `Bearer ${adminToken}`).send({ tags: ['vip'] });

    const res = await request(app).patch(`/api/v1/admin/customers/${customerId}`).set('Authorization', `Bearer ${adminToken}`).send({ notesInternal: 'Called about a return.' });
    expect(res.status).toBe(200);
    expect(res.body.data.customer.tags).toEqual(['vip']);
    expect(res.body.data.customer.notesInternal).toBe('Called about a return.');
  });

  it('a customer (no customers.write) cannot patch their own tags', async () => {
    const app = buildApp();
    const { token: customerToken, userId: customerId } = await registerAndLogin(app, 'customer');
    const res = await request(app).patch(`/api/v1/admin/customers/${customerId}`).set('Authorization', `Bearer ${customerToken}`).send({ tags: ['vip'] });
    expect(res.status).toBe(403);
  });
});
