import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Express } from 'express';
import { randomInt } from 'node:crypto';
import { createApp } from '../../../app.js';
import { connect, disconnect } from '../../../shared/mongo.js';
import { InMemoryRateLimitStore } from '../../../shared/rate-limit.js';
import { InMemoryReservationStore } from '../../cart/reservation-store.js';
import { InMemoryIdempotencyStore } from '../idempotency-store.js';
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
import { CheckoutSessionModel } from '../checkout.model.js';
import { CodOtpModel } from '../../payment/cod-otp.model.js';
import { WebhookEventModel } from '../../payment/webhook-event.model.js';
import { OrderModel, CounterModel } from '../../order/order.model.js';

/**
 * End-to-end integration coverage for `checkout` + `order` + `payment`
 * (COD half) — plan.md §9.5, §8.7, §20. Priorities per the brief: the
 * idempotency-key behaviour on `place` (a retry must not create a second
 * order), the COD OTP flow end to end, and that stock actually decrements
 * (not just reservation-releases) on order confirmation.
 *
 * `node:crypto`'s `randomInt` is mocked (see `payment/__tests__/cod
 * .gateway.test.ts`'s doc comment on why `vi.mock`, not `vi.spyOn`) so the
 * OTP code generated deep inside the HTTP flow is knowable to the test.
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

function buildApp(): { app: Express; reservationStore: InMemoryReservationStore; idempotencyStore: InMemoryIdempotencyStore } {
  const reservationStore = new InMemoryReservationStore();
  const idempotencyStore = new InMemoryIdempotencyStore();
  const app = createApp({ rateLimitStore: new InMemoryRateLimitStore(), reservationStore, idempotencyStore });
  return { app, reservationStore, idempotencyStore };
}

let phoneCounter = 540000000;

async function registerAndLogin(app: Express, role: 'super_admin' | 'customer' = 'customer'): Promise<{ token: string; userId: string; email: string }> {
  phoneCounter += 1;
  const email = `user-${phoneCounter}@example.com`;
  const password = 'correct-horse-battery-staple';
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'A', lastName: 'B', phone: { countryCode: '+971', number: String(phoneCounter) } });
  const userId = registerRes.body.data.user.id as string;
  if (role !== 'customer') await UserModel.updateOne({ email }, { role });
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
  return { token: loginRes.body.data.accessToken as string, userId, email };
}

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

/** Drives a cart all the way through checkout up to (but not including)
 *  `place` — the shared setup every place/idempotency/OTP test starts from. */
async function checkoutUpToPaymentIntent(app: Express, adminToken: string, onHand = 10, priceFils = 24_900): Promise<{ sessionId: string; variantId: string; productId: string }> {
  const { variantId, productId } = await seedVariantWithStock(app, adminToken, onHand, priceFils);
  const agent = request.agent(app);
  const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
  await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 2 });

  const sessionRes = await agent.post('/api/v1/checkout/session').send({ cartId, guestEmail: 'shopper@example.com' });
  expect(sessionRes.status).toBe(201);
  const sessionId = sessionRes.body.data.sessionId as string;

  const addrRes = await agent.post(`/api/v1/checkout/session/${sessionId}/address`).send(inlineShippingAddress());
  expect(addrRes.status).toBe(200);

  const shipRes = await agent.post(`/api/v1/checkout/session/${sessionId}/shipping`).send({});
  expect(shipRes.status).toBe(200);

  return { sessionId, variantId, productId };
}

describe('guest COD checkout — full flow', () => {
  it('creates a session, walks address -> shipping -> COD OTP -> place, confirms the order, and actually decrements stock (not just releases the reservation)', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { sessionId, variantId, productId } = await checkoutUpToPaymentIntent(app, adminToken, 10, 24_900);

    pinNextOtp(482913);
    const intentRes = await request(app).post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'cod' });
    expect(intentRes.status).toBe(201);
    expect(intentRes.body.data).toEqual({ method: 'cod', redirectUrl: null, otpRequired: true });

    // Wrong code first — must be rejected, and must count against the 3-attempt cap.
    const wrongOtp = await request(app).post('/api/v1/checkout/cod/verify-otp').send({ sessionId, code: '000000' });
    expect(wrongOtp.status).toBe(400);
    expect(wrongOtp.body.error.code).toBe('AUTH_OTP_INVALID');

    const otpRes = await request(app).post('/api/v1/checkout/cod/verify-otp').send({ sessionId, code: '482913' });
    expect(otpRes.status).toBe(200);

    const placeRes = await request(app).post(`/api/v1/checkout/session/${sessionId}/place`).set('Idempotency-Key', 'order-key-1').send({});
    expect(placeRes.status).toBe(201);
    const order = placeRes.body.data.order;
    expect(order.orderNumber).toMatch(/^LF-\d{6}-\d{4}$/);
    // COD auto-confirms immediately — no online payment to await (see
    // `order.service.ts#createOrderFromCheckout`'s doc comment).
    expect(order.status).toBe('confirmed');
    expect(order.statusHistory).toHaveLength(2);
    expect(order.statusHistory[0]).toMatchObject({ from: null, to: 'pending_payment' });
    expect(order.statusHistory[1]).toMatchObject({ from: 'pending_payment', to: 'confirmed' });
    expect(order.guestEmail).toBe('shopper@example.com');
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(2);
    expect(order.grandTotalFils).toBeGreaterThan(0);

    // The critical assertion: stock actually decremented, not just released.
    const item = await InventoryItemModel.findOne({ variantId }).lean();
    expect(item?.onHand).toBe(8); // 10 - 2, a real sale
    expect(item?.reserved).toBe(0); // the reservation was converted, not left dangling
    expect(item?.available).toBe(8);

    const saleMovements = await StockMovementModel.find({ variantId, type: 'sale' }).lean();
    expect(saleMovements).toHaveLength(1);
    expect(saleMovements[0]?.quantity).toBe(-2);

    // Product soldCount incremented (internal-only field, not on the wire DTO).
    const product = await ProductModel.findById(productId).lean();
    expect(product?.soldCount).toBe(2);

    // The cart is converted — no longer resolvable as an active cart.
    const cartAfter = await CartModel.findOne({}).lean();
    expect(cartAfter?.status).toBe('converted');
  });

  it('Idempotency-Key: a retried place request returns the SAME order, never creates a second one', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { sessionId, variantId } = await checkoutUpToPaymentIntent(app, adminToken, 10);

    pinNextOtp(111222);
    await request(app).post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'cod' });
    await request(app).post('/api/v1/checkout/cod/verify-otp').send({ sessionId, code: '111222' });

    const first = await request(app).post(`/api/v1/checkout/session/${sessionId}/place`).set('Idempotency-Key', 'retry-key').send({});
    expect(first.status).toBe(201);
    const firstOrderId = first.body.data.order.id as string;

    // Retried exactly as a client would after a dropped response — same
    // key, same (now-completed) session.
    const second = await request(app).post(`/api/v1/checkout/session/${sessionId}/place`).set('Idempotency-Key', 'retry-key').send({});
    expect(second.status).toBe(200); // not 201 — this is a replay, nothing was created
    expect(second.body.data.order.id).toBe(firstOrderId);

    const orders = await OrderModel.find({}).lean();
    expect(orders).toHaveLength(1); // never a second order

    // Stock was only ever decremented once, not twice.
    const item = await InventoryItemModel.findOne({ variantId }).lean();
    expect(item?.onHand).toBe(8);
  });

  it('place without an Idempotency-Key header is rejected before any side effect runs', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { sessionId } = await checkoutUpToPaymentIntent(app, adminToken, 10);
    pinNextOtp(333444);
    await request(app).post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'cod' });
    await request(app).post('/api/v1/checkout/cod/verify-otp').send({ sessionId, code: '333444' });

    const res = await request(app).post(`/api/v1/checkout/session/${sessionId}/place`).send({});
    expect(res.status).toBe(400);
    expect(await OrderModel.countDocuments({})).toBe(0);
  });

  it('place is rejected with COD_OTP_REQUIRED if the OTP was never verified', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { sessionId } = await checkoutUpToPaymentIntent(app, adminToken, 10);
    pinNextOtp(555666);
    await request(app).post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'cod' }); // requested, never verified

    const res = await request(app).post(`/api/v1/checkout/session/${sessionId}/place`).set('Idempotency-Key', 'no-otp-key').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COD_OTP_REQUIRED');
  });

  it('COD is refused above COD_MAX_ORDER_FILS with COD_LIMIT_EXCEEDED', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    // Default COD_MAX_ORDER_FILS is 200,000 fils — one very expensive line comfortably clears it.
    const { sessionId } = await checkoutUpToPaymentIntent(app, adminToken, 10, 500_000);

    const res = await request(app).post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'cod' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COD_LIMIT_EXCEEDED');
  });

  it('card payment intent creation 503s cleanly — no Ziina account is configured in this environment', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { sessionId } = await checkoutUpToPaymentIntent(app, adminToken, 10);

    const res = await request(app).post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'card' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('rejects placing when the variant price changed since the session locked it', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { sessionId, variantId } = await checkoutUpToPaymentIntent(app, adminToken, 10);
    pinNextOtp(777888);
    await request(app).post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'cod' });
    await request(app).post('/api/v1/checkout/cod/verify-otp').send({ sessionId, code: '777888' });

    await VariantModel.updateOne({ _id: variantId }, { priceFils: 19_900 }); // repriced mid-checkout

    const res = await request(app).post(`/api/v1/checkout/session/${sessionId}/place`).set('Idempotency-Key', 'price-changed-key').send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CHECKOUT_PRICE_CHANGED');
    expect(await OrderModel.countDocuments({})).toBe(0);
  });
});

describe('guest order tracking', () => {
  async function placeAGuestOrder(app: Express, adminToken: string): Promise<{ orderNumber: string; email: string }> {
    const { sessionId } = await checkoutUpToPaymentIntent(app, adminToken, 10);
    pinNextOtp(246810);
    await request(app).post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'cod' });
    await request(app).post('/api/v1/checkout/cod/verify-otp').send({ sessionId, code: '246810' });
    const placeRes = await request(app).post(`/api/v1/checkout/session/${sessionId}/place`).set('Idempotency-Key', `track-${sessionId}`).send({});
    return { orderNumber: placeRes.body.data.order.orderNumber as string, email: 'shopper@example.com' };
  }

  it('finds the order for a matching order number + email, and 404s for a wrong email', async () => {
    const { app } = buildApp();
    const adminToken = (await registerAndLogin(app, 'super_admin')).token;
    const { orderNumber, email } = await placeAGuestOrder(app, adminToken);

    const good = await request(app).get('/api/v1/orders/track').query({ orderNumber, emailOrPhone: email });
    expect(good.status).toBe(200);
    expect(good.body.data.order.orderNumber).toBe(orderNumber);
    // The public tracking view never leaks the financial breakdown.
    expect(good.body.data.order.grandTotalFils).toBeUndefined();
    expect(good.body.data.order.payment).toBeUndefined();

    const bad = await request(app).get('/api/v1/orders/track').query({ orderNumber, emailOrPhone: 'someone-else@example.com' });
    expect(bad.status).toBe(404);
    expect(bad.body.error.code).toBe('ORDER_NOT_FOUND');
  });
});

describe('admin order status transitions', () => {
  it('applies a valid transition and rejects an invalid one with 409 INVALID_STATUS_TRANSITION', async () => {
    const { app } = buildApp();
    const admin = await registerAndLogin(app, 'super_admin');
    const { sessionId } = await checkoutUpToPaymentIntent(app, admin.token, 10);
    pinNextOtp(135790);
    await request(app).post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'cod' });
    await request(app).post('/api/v1/checkout/cod/verify-otp').send({ sessionId, code: '135790' });
    const placeRes = await request(app).post(`/api/v1/checkout/session/${sessionId}/place`).set('Idempotency-Key', `admin-${sessionId}`).send({});
    const orderId = placeRes.body.data.order.id as string;
    expect(placeRes.body.data.order.status).toBe('confirmed');

    // confirmed -> processing is valid.
    const validRes = await request(app).patch(`/api/v1/admin/orders/${orderId}/status`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'processing', notifyCustomer: false });
    expect(validRes.status).toBe(200);
    expect(validRes.body.data.order.status).toBe('processing');

    // processing -> delivered is NOT in the table. The actor here is
    // super_admin, who MAY force it — but only with a mandatory reason
    // (plan.md §8.7.2), so omitting one is a 400, not a 409.
    const noReasonRes = await request(app).patch(`/api/v1/admin/orders/${orderId}/status`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'delivered', notifyCustomer: false });
    expect(noReasonRes.status).toBe(400);
    expect(noReasonRes.body.error.code).toBe('VALIDATION_FAILED');

    // With a reason, the super_admin force succeeds despite being outside the table.
    const forcedRes = await request(app).patch(`/api/v1/admin/orders/${orderId}/status`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'delivered', note: 'Customer confirmed receipt over the phone.', notifyCustomer: false });
    expect(forcedRes.status).toBe(200);
    expect(forcedRes.body.data.order.status).toBe('delivered');
    expect(forcedRes.body.data.order.statusHistory.at(-1)).toMatchObject({ from: 'processing', to: 'delivered', note: 'Customer confirmed receipt over the phone.' });

    // A non-super_admin role is constrained to the table, even with a reason (order_ops has orders.status.update, not the force escape hatch).
    await UserModel.updateOne({ _id: admin.userId }, { role: 'order_ops' });
    const opsLogin = await request(app).post('/api/v1/auth/login').send({ email: admin.email, password: 'correct-horse-battery-staple' });
    const opsToken = opsLogin.body.data.accessToken as string;
    const opsInvalid = await request(app).patch(`/api/v1/admin/orders/${orderId}/status`).set('Authorization', `Bearer ${opsToken}`).send({ status: 'delivered', notifyCustomer: false });
    expect(opsInvalid.status).toBe(409);
  });

  it('cancelling an already-confirmed order restocks the physical stock (not just a reservation release) and reverses discount usage', async () => {
    const { app } = buildApp();
    const admin = await registerAndLogin(app, 'super_admin');
    await request(app)
      .post('/api/v1/admin/discounts')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Ten Off', mode: 'code', code: 'TENOFF', type: 'percentage', value: 10, appliesTo: 'all', status: 'active' });

    const { variantId } = await seedVariantWithStock(app, admin.token, 10, 24_900);
    const agent = request.agent(app);
    const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
    await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 2 });
    await agent.post(`/api/v1/cart/${cartId}/coupon`).send({ code: 'TENOFF' });

    const sessionRes = await agent.post('/api/v1/checkout/session').send({ cartId, guestEmail: 'buyer@example.com' });
    const sessionId = sessionRes.body.data.sessionId as string;
    await agent.post(`/api/v1/checkout/session/${sessionId}/address`).send(inlineShippingAddress());
    await agent.post(`/api/v1/checkout/session/${sessionId}/shipping`).send({});
    pinNextOtp(864209);
    await agent.post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'cod' });
    await agent.post('/api/v1/checkout/cod/verify-otp').send({ sessionId, code: '864209' });
    const placeRes = await agent.post(`/api/v1/checkout/session/${sessionId}/place`).set('Idempotency-Key', `cancel-${sessionId}`).send({});
    const orderId = placeRes.body.data.order.id as string;
    expect(placeRes.body.data.order.status).toBe('confirmed');
    expect(placeRes.body.data.order.discountTotalFils).toBeGreaterThan(0);

    const discountAfterOrder = await DiscountModel.findOne({ code: 'TENOFF' }).lean();
    expect(discountAfterOrder?.usage.usedCount).toBe(1);

    const itemAfterConfirm = await InventoryItemModel.findOne({ variantId }).lean();
    expect(itemAfterConfirm?.onHand).toBe(8);

    const cancelRes = await request(app).patch(`/api/v1/admin/orders/${orderId}/status`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'cancelled', note: 'Customer changed their mind.', notifyCustomer: false });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.order.status).toBe('cancelled');

    const itemAfterCancel = await InventoryItemModel.findOne({ variantId }).lean();
    expect(itemAfterCancel?.onHand).toBe(10); // physically restocked, not merely "un-reserved"
    expect(itemAfterCancel?.reserved).toBe(0);
    expect(itemAfterCancel?.available).toBe(10);

    const discountAfterCancel = await DiscountModel.findOne({ code: 'TENOFF' }).lean();
    expect(discountAfterCancel?.usage.usedCount).toBe(0); // redemption given back
  });

  it('POST /admin/orders/:id/notes adds an internal note (never on the customer-facing status history)', async () => {
    const { app } = buildApp();
    const admin = await registerAndLogin(app, 'super_admin');
    const { sessionId } = await checkoutUpToPaymentIntent(app, admin.token, 10);
    pinNextOtp(102938);
    await request(app).post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'cod' });
    await request(app).post('/api/v1/checkout/cod/verify-otp').send({ sessionId, code: '102938' });
    const placeRes = await request(app).post(`/api/v1/checkout/session/${sessionId}/place`).set('Idempotency-Key', `note-${sessionId}`).send({});
    const orderId = placeRes.body.data.order.id as string;

    const noteRes = await request(app).post(`/api/v1/admin/orders/${orderId}/notes`).set('Authorization', `Bearer ${admin.token}`).send({ note: 'Customer called to confirm address.' });
    expect(noteRes.status).toBe(201);
    // The note is never part of the wire `Order` shape's own fields.
    expect(noteRes.body.data.order.internalNotes).toBeUndefined();

    const stored = await OrderModel.findById(orderId).lean();
    expect(stored?.internalNotes).toHaveLength(1);
    expect(stored?.internalNotes[0]?.note).toBe('Customer called to confirm address.');
  });
});

describe('admin order refund (plan.md §8.8)', () => {
  /** COD's `paymentStatus` only flips to `paid` on delivery (see
   *  `order.service.ts`'s `order.delivered` listener) — a refund requires
   *  a captured payment to exist, so this drives a COD order all the way
   *  there (forcing `confirmed -> delivered` directly as `super_admin`,
   *  the documented escape hatch, since it's not in the transition table). */
  async function placeAndDeliverCodOrder(app: Express, admin: { token: string }): Promise<{ orderId: string; grandTotalFils: number }> {
    const { sessionId } = await checkoutUpToPaymentIntent(app, admin.token, 10);
    pinNextOtp(918273);
    await request(app).post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'cod' });
    await request(app).post('/api/v1/checkout/cod/verify-otp').send({ sessionId, code: '918273' });
    const placeRes = await request(app).post(`/api/v1/checkout/session/${sessionId}/place`).set('Idempotency-Key', `refund-${sessionId}`).send({});
    const orderId = placeRes.body.data.order.id as string;
    expect(placeRes.body.data.order.status).toBe('confirmed');

    const deliverRes = await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'delivered', note: 'Test: force to delivered for refund coverage.', notifyCustomer: false });
    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.data.order.paymentStatus).toBe('paid');

    return { orderId, grandTotalFils: deliverRes.body.data.order.grandTotalFils as number };
  }

  it('a full refund (amountFils omitted) refunds everything paid, records an immutable refund entry, and flips paymentStatus to refunded', async () => {
    const { app } = buildApp();
    const admin = await registerAndLogin(app, 'super_admin');
    const { orderId, grandTotalFils } = await placeAndDeliverCodOrder(app, admin);

    const refundRes = await request(app).post(`/api/v1/admin/orders/${orderId}/refund`).set('Authorization', `Bearer ${admin.token}`).send({ reason: 'Customer changed their mind.' });
    expect(refundRes.status).toBe(201);
    const order = refundRes.body.data.order;
    expect(order.refundedFils).toBe(grandTotalFils);
    expect(order.balanceDueFils).toBe(0); // unaffected by the refund — see order.service.ts#refundOrder's doc comment
    expect(order.paymentStatus).toBe('refunded');
    expect(order.refunds).toHaveLength(1);
    expect(order.refunds[0]).toMatchObject({ amountFils: grandTotalFils, status: 'completed', reason: 'Customer changed their mind.' });
    expect(order.refunds[0].gatewayRefundId).toEqual(expect.stringContaining('cod_refund_'));

    // Nothing left to refund — rejected, not silently accepted as a $0 no-op.
    const secondRefund = await request(app).post(`/api/v1/admin/orders/${orderId}/refund`).set('Authorization', `Bearer ${admin.token}`).send({});
    expect(secondRefund.status).toBe(409);
    expect(secondRefund.body.error.code).toBe('CONFLICT');
  });

  it('a partial refund updates refundedFils and sets paymentStatus to partially_refunded, without disturbing balanceDueFils', async () => {
    const { app } = buildApp();
    const admin = await registerAndLogin(app, 'super_admin');
    const { orderId, grandTotalFils } = await placeAndDeliverCodOrder(app, admin);
    const partial = Math.floor(grandTotalFils / 2);

    const refundRes = await request(app).post(`/api/v1/admin/orders/${orderId}/refund`).set('Authorization', `Bearer ${admin.token}`).send({ amountFils: partial });
    expect(refundRes.status).toBe(201);
    const order = refundRes.body.data.order;
    expect(order.refundedFils).toBe(partial);
    // A refund is symmetric — it reduces both what was owed and what was
    // paid by the same amount, so it cancels out of "owed minus paid"
    // entirely (see order.service.ts#refundOrder's own doc comment).
    // balanceDueFils stays whatever it was at payment capture (0, already
    // fully paid) — refunds are tracked via refundedFils/paymentStatus,
    // not by this field going negative.
    expect(order.balanceDueFils).toBe(0);
    expect(order.paymentStatus).toBe('partially_refunded');
  });

  it('rejects with 409 CONFLICT when the order has no captured payment yet, and 403 for an actor missing refunds.write', async () => {
    const { app } = buildApp();
    const admin = await registerAndLogin(app, 'super_admin');
    const { sessionId } = await checkoutUpToPaymentIntent(app, admin.token, 10);
    pinNextOtp(102938);
    await request(app).post(`/api/v1/checkout/session/${sessionId}/payment-intent`).send({ method: 'cod' });
    await request(app).post('/api/v1/checkout/cod/verify-otp').send({ sessionId, code: '102938' });
    const placeRes = await request(app).post(`/api/v1/checkout/session/${sessionId}/place`).set('Idempotency-Key', `refund-unpaid-${sessionId}`).send({});
    const orderId = placeRes.body.data.order.id as string;
    // Still `confirmed`, never delivered — COD's paymentStatus is still 'unpaid'.

    const conflictRes = await request(app).post(`/api/v1/admin/orders/${orderId}/refund`).set('Authorization', `Bearer ${admin.token}`).send({});
    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error.code).toBe('CONFLICT');

    // `catalog` role has no `refunds.write` (see identity.policy.ts's ROLE_PERMISSIONS).
    await UserModel.updateOne({ _id: admin.userId }, { role: 'catalog' });
    const catalogLogin = await request(app).post('/api/v1/auth/login').send({ email: admin.email, password: 'correct-horse-battery-staple' });
    const catalogToken = catalogLogin.body.data.accessToken as string;
    const forbiddenRes = await request(app).post(`/api/v1/admin/orders/${orderId}/refund`).set('Authorization', `Bearer ${catalogToken}`).send({});
    expect(forbiddenRes.status).toBe(403);
  });
});
