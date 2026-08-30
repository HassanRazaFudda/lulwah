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
import { ReviewModel } from '../review.model.js';
import { WishlistModel } from '../wishlist.model.js';

/**
 * Integration coverage for `engagement` — plan.md §9.2/§9.4 (reviews +
 * wishlist) and §11.1's Customer detail screen composition. Exercises the
 * real HTTP surface (routes → controllers → services → repositories →
 * Mongoose) against `mongodb-memory-server`, same pattern as
 * `customer.integration.test.ts`/`content.integration.test.ts`.
 *
 * The verified-purchase check needs a real order that actually reached
 * `delivered` — driven through the real checkout + `PATCH
 * /admin/orders/:id/status` state machine (same fixtures
 * `customer.integration.test.ts#placeCodOrderForCustomer` uses for its own
 * "real order" fixtures) rather than a hand-rolled `OrderModel.create()`
 * that could silently drift from what the real flow actually produces.
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
    ReviewModel.syncIndexes(),
    WishlistModel.syncIndexes(),
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
    CheckoutSessionModel.deleteMany({}),
    CodOtpModel.deleteMany({}),
    WebhookEventModel.deleteMany({}),
    OrderModel.deleteMany({}),
    CounterModel.deleteMany({}),
    ReviewModel.deleteMany({}),
    WishlistModel.deleteMany({}),
  ]);
});

function buildApp(): Express {
  return createApp({ rateLimitStore: new InMemoryRateLimitStore(), reservationStore: new InMemoryReservationStore(), idempotencyStore: new InMemoryIdempotencyStore() });
}

let phoneCounter = 560000000;

async function registerAndLogin(app: Express, role: 'super_admin' | 'content' | 'catalog' | 'order_ops' | 'finance' | 'customer' = 'customer'): Promise<{ token: string; userId: string; email: string }> {
  phoneCounter += 1;
  const email = `user-${phoneCounter}@example.com`;
  const password = 'correct-horse-battery-staple';
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'Sana', lastName: 'Rehman', phone: { countryCode: '+971', number: String(phoneCounter) } });
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

/** Drives a real guest COD checkout to completion, attaches it to
 *  `customerId` (checkout's own routes carry no auth middleware — same
 *  documented gap `customer.integration.test.ts#placeCodOrderForCustomer`
 *  works around identically), then walks the order through the real
 *  `PATCH /admin/orders/:id/status` state machine all the way to
 *  `delivered` (`confirmed -> processing -> ready_to_ship -> shipped ->
 *  delivered` — the shortest legal path in `order.transitions.ts`). */
async function placeDeliveredOrderForCustomer(app: Express, adminToken: string, customerId: string, variantId: string, otpCode: number): Promise<{ orderId: string }> {
  const agent = request.agent(app);
  const cartId = (await agent.post('/api/v1/cart').send({})).body.data.cartId as string;
  await agent.post(`/api/v1/cart/${cartId}/items`).send({ variantId, quantity: 1 });

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
    .set('Idempotency-Key', `engagement-order-key-${otpCode}`)
    .send({});
  const orderId = placeRes.body.data.order.id as string;

  await OrderModel.updateOne({ _id: orderId }, { userId: customerId });

  for (const status of ['processing', 'ready_to_ship', 'shipped', 'delivered']) {
    const res = await request(app).patch(`/api/v1/admin/orders/${orderId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status, notifyCustomer: false });
    expect(res.status).toBe(200);
  }

  return { orderId };
}

describe('POST /api/v1/me/reviews', () => {
  it('requires authentication', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { productId } = await seedVariantWithStock(app, adminToken, 5);

    const res = await request(app).post('/api/v1/me/reviews').send({ productId, rating: 5, title: 'Lovely', body: 'Great fabric.' });
    expect(res.status).toBe(401);
  });

  it('a shopper with no matching order can still submit a review, but isVerifiedPurchase is false', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { productId } = await seedVariantWithStock(app, adminToken, 5);
    const { token: shopperToken } = await registerAndLogin(app, 'customer');

    const res = await request(app)
      .post('/api/v1/me/reviews')
      .set('Authorization', `Bearer ${shopperToken}`)
      .send({ productId, rating: 4, title: 'Nice quality', body: 'Fabric feels good, true to the photos.', fitFeedback: 'true' });

    expect(res.status).toBe(201);
    expect(res.body.data.review.isVerifiedPurchase).toBe(false);
    expect(res.body.data.review.orderId).toBeNull();
    expect(res.body.data.review.status).toBe('pending');
  });

  it('a shopper with a real delivered order for the product gets isVerifiedPurchase: true and a real orderId', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { variantId, productId } = await seedVariantWithStock(app, adminToken, 5);
    const { token: shopperToken, userId: shopperId } = await registerAndLogin(app, 'customer');

    const { orderId } = await placeDeliveredOrderForCustomer(app, adminToken, shopperId, variantId, 321111);

    const res = await request(app)
      .post('/api/v1/me/reviews')
      .set('Authorization', `Bearer ${shopperToken}`)
      .send({ productId, rating: 5, title: 'Runs true to size', body: 'Received it, fits exactly as expected.', fitFeedback: 'true' });

    expect(res.status).toBe(201);
    expect(res.body.data.review.isVerifiedPurchase).toBe(true);
    expect(res.body.data.review.orderId).toBe(orderId);
    expect(res.body.data.review.status).toBe('pending');
  });

  it('rejects a client-supplied isVerifiedPurchase/orderId — those fields are simply not accepted from the request body', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { productId } = await seedVariantWithStock(app, adminToken, 5);
    const { token: shopperToken } = await registerAndLogin(app, 'customer');

    const res = await request(app)
      .post('/api/v1/me/reviews')
      .set('Authorization', `Bearer ${shopperToken}`)
      .send({ productId, rating: 5, title: 'Trying to fake it', body: 'x', isVerifiedPurchase: true, orderId: '000000000000000000000000' });

    expect(res.status).toBe(201);
    // A spoofed `isVerifiedPurchase: true` in the request body is silently
    // ignored (Zod strips unknown keys) — with no real matching order,
    // the server-computed value is still false.
    expect(res.body.data.review.isVerifiedPurchase).toBe(false);
  });

  it('rejects a second review from the same shopper for the same product (409 CONFLICT)', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { productId } = await seedVariantWithStock(app, adminToken, 5);
    const { token: shopperToken } = await registerAndLogin(app, 'customer');

    const first = await request(app).post('/api/v1/me/reviews').set('Authorization', `Bearer ${shopperToken}`).send({ productId, rating: 3, title: 'Okay', body: 'It is fine.' });
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/v1/me/reviews').set('Authorization', `Bearer ${shopperToken}`).send({ productId, rating: 5, title: 'Changed my mind', body: 'Actually great.' });
    expect(second.status).toBe(409);
  });
});

describe('GET /api/v1/products/:id/reviews', () => {
  it('a pending review is invisible; approving it via the admin endpoint makes it show up', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { productId } = await seedVariantWithStock(app, adminToken, 5);
    const { token: shopperToken } = await registerAndLogin(app, 'customer');

    const createRes = await request(app)
      .post('/api/v1/me/reviews')
      .set('Authorization', `Bearer ${shopperToken}`)
      .send({ productId, rating: 5, title: 'Beautiful', body: 'Colour is exactly as shown.' });
    const reviewId = createRes.body.data.review.id as string;

    const beforeApproval = await request(app).get(`/api/v1/products/${productId}/reviews`);
    expect(beforeApproval.status).toBe(200);
    expect(beforeApproval.body.data.reviews).toHaveLength(0);

    const approveRes = await request(app).patch(`/api/v1/admin/reviews/${reviewId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'approved' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.review.status).toBe('approved');

    const afterApproval = await request(app).get(`/api/v1/products/${productId}/reviews`);
    expect(afterApproval.status).toBe(200);
    expect(afterApproval.body.data.reviews).toHaveLength(1);
    expect(afterApproval.body.data.reviews[0].id).toBe(reviewId);
    // The public shape never leaks internal linkage.
    expect(afterApproval.body.data.reviews[0].userId).toBeUndefined();
    expect(afterApproval.body.data.reviews[0].orderId).toBeUndefined();
    expect(afterApproval.body.data.reviews[0].status).toBeUndefined();
  });

  it('a rejected review never appears publicly', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { productId } = await seedVariantWithStock(app, adminToken, 5);
    const { token: shopperToken } = await registerAndLogin(app, 'customer');

    const createRes = await request(app).post('/api/v1/me/reviews').set('Authorization', `Bearer ${shopperToken}`).send({ productId, rating: 1, title: 'Not for me', body: 'Did not like it.' });
    const reviewId = createRes.body.data.review.id as string;

    await request(app).patch(`/api/v1/admin/reviews/${reviewId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'rejected' });

    const res = await request(app).get(`/api/v1/products/${productId}/reviews`);
    expect(res.body.data.reviews).toHaveLength(0);
  });
});

describe('RBAC — /api/v1/admin/reviews*', () => {
  it('requires authentication', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/admin/reviews');
    expect(res.status).toBe(401);
  });

  it('a plain customer (no reviews.read) is forbidden', async () => {
    const app = buildApp();
    const { token } = await registerAndLogin(app, 'customer');
    const res = await request(app).get('/api/v1/admin/reviews').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('a role with unrelated permissions (order_ops: no reviews.read) is forbidden', async () => {
    const app = buildApp();
    const { token } = await registerAndLogin(app, 'order_ops');
    const res = await request(app).get('/api/v1/admin/reviews').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('content role (reviews.read + reviews.write, mirroring content.read/write) can list, approve and reply', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { productId } = await seedVariantWithStock(app, adminToken, 5);
    const { token: shopperToken } = await registerAndLogin(app, 'customer');
    const createRes = await request(app).post('/api/v1/me/reviews').set('Authorization', `Bearer ${shopperToken}`).send({ productId, rating: 5, title: 'Lovely', body: 'x' });
    const reviewId = createRes.body.data.review.id as string;

    const { token: contentToken } = await registerAndLogin(app, 'content');

    const listRes = await request(app).get('/api/v1/admin/reviews?status=pending').set('Authorization', `Bearer ${contentToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.reviews.map((r: { id: string }) => r.id)).toContain(reviewId);

    const statusRes = await request(app).patch(`/api/v1/admin/reviews/${reviewId}/status`).set('Authorization', `Bearer ${contentToken}`).send({ status: 'approved' });
    expect(statusRes.status).toBe(200);

    const replyRes = await request(app).patch(`/api/v1/admin/reviews/${reviewId}/reply`).set('Authorization', `Bearer ${contentToken}`).send({ adminReply: 'Thank you for the kind words!' });
    expect(replyRes.status).toBe(200);
    expect(replyRes.body.data.review.adminReply).toBe('Thank you for the kind words!');
  });
});

describe('me/wishlist — guest and logged-in', () => {
  it('a guest can add, read and remove wishlist items via a persistent cookie', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { variantId, productId } = await seedVariantWithStock(app, adminToken, 5, 30_000);

    const agent = request.agent(app);
    const addRes = await agent.post('/api/v1/me/wishlist').send({ productId, variantId });
    expect(addRes.status).toBe(201);
    expect(addRes.body.data.wishlist.items).toHaveLength(1);
    expect(addRes.body.data.wishlist.items[0].productId).toBe(productId);
    expect(addRes.body.data.wishlist.items[0].priceAtAddFils).toBe(30_000);
    expect(addRes.body.data.wishlist.userId).toBeNull();
    expect(addRes.body.data.wishlist.guestId).not.toBeNull();

    // The same browser session (cookie jar) reading it back sees the item.
    const getRes = await agent.get('/api/v1/me/wishlist');
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.wishlist.items).toHaveLength(1);

    // A different, cookie-less client gets its own, empty wishlist — proof
    // guest identity really is cookie-scoped, not global.
    const strangerRes = await request(app).get('/api/v1/me/wishlist');
    expect(strangerRes.status).toBe(200);
    expect(strangerRes.body.data.wishlist.items).toHaveLength(0);

    const removeRes = await agent.delete(`/api/v1/me/wishlist/${productId}`);
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.data.wishlist.items).toHaveLength(0);
  });

  it('a logged-in shopper wishlist is keyed by userId, not a cookie, and adding the same product twice is idempotent', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { variantId, productId } = await seedVariantWithStock(app, adminToken, 5);
    const { token: shopperToken } = await registerAndLogin(app, 'customer');

    const first = await request(app).post('/api/v1/me/wishlist').set('Authorization', `Bearer ${shopperToken}`).send({ productId, variantId });
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/v1/me/wishlist').set('Authorization', `Bearer ${shopperToken}`).send({ productId, variantId });
    expect(second.status).toBe(201);
    expect(second.body.data.wishlist.items).toHaveLength(1);

    const getRes = await request(app).get('/api/v1/me/wishlist').set('Authorization', `Bearer ${shopperToken}`);
    expect(getRes.body.data.wishlist.items).toHaveLength(1);
    expect(getRes.body.data.wishlist.guestId).toBeNull();
  });

  it('a variant that does not belong to the given product is rejected (400)', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { productId: productA } = await seedVariantWithStock(app, adminToken, 5);
    const { variantId: variantB } = await seedVariantWithStock(app, adminToken, 5);
    const { token: shopperToken } = await registerAndLogin(app, 'customer');

    const res = await request(app).post('/api/v1/me/wishlist').set('Authorization', `Bearer ${shopperToken}`).send({ productId: productA, variantId: variantB });
    expect(res.status).toBe(400);
  });

  it('POST /me/wishlist/merge folds a guest wishlist into the just-logged-in user, unions with any existing items, and clears the guest cookie', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { productId: guestProductId } = await seedVariantWithStock(app, adminToken, 5);
    const { productId: userProductId } = await seedVariantWithStock(app, adminToken, 5);
    const { token: shopperToken } = await registerAndLogin(app, 'customer');

    // The user already has one item, saved while genuinely signed in.
    await request(app).post('/api/v1/me/wishlist').set('Authorization', `Bearer ${shopperToken}`).send({ productId: userProductId });

    // Same browser, before logging in: a guest wishlist with a different item.
    const agent = request.agent(app);
    await agent.post('/api/v1/me/wishlist').send({ productId: guestProductId });

    const mergeRes = await agent.post('/api/v1/me/wishlist/merge').set('Authorization', `Bearer ${shopperToken}`);
    expect(mergeRes.status).toBe(200);
    const mergedIds = mergeRes.body.data.wishlist.items.map((item: { productId: string }) => item.productId).sort();
    expect(mergedIds).toEqual([guestProductId, userProductId].sort());
    expect(mergeRes.body.data.wishlist.guestId).toBeNull();
    // The guest cookie is cleared, not carried forward — a stale merged-away
    // guestId must never resurface a phantom wishlist on a later logout.
    const setCookieHeader = mergeRes.headers['set-cookie'];
    const guestCookieHeader = Array.isArray(setCookieHeader) ? setCookieHeader.find((c: string) => c.startsWith('lulwah_wishlist_guest=')) : undefined;
    expect(guestCookieHeader).toMatch(/lulwah_wishlist_guest=;/);

    // Confirmed durably merged, not just in the merge response: a fresh
    // logged-in read (no cookie at all) sees both items.
    const getRes = await request(app).get('/api/v1/me/wishlist').set('Authorization', `Bearer ${shopperToken}`);
    expect(getRes.body.data.wishlist.items).toHaveLength(2);
  });

  it('POST /me/wishlist/merge with no guest cookie just returns the logged-in user\'s own wishlist', async () => {
    const app = buildApp();
    const { token: shopperToken } = await registerAndLogin(app, 'customer');

    const res = await request(app).post('/api/v1/me/wishlist/merge').set('Authorization', `Bearer ${shopperToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.wishlist.items).toHaveLength(0);
  });

  it('POST /me/wishlist/merge requires a real login (401 without a token)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/v1/me/wishlist/merge');
    expect(res.status).toBe(401);
  });
});

describe('Customer detail composition — /api/v1/admin/customers/:id/{reviews,wishlist}', () => {
  it('GET .../reviews requires reviews.read (403 for a plain customer)', async () => {
    const app = buildApp();
    const { token, userId } = await registerAndLogin(app, 'customer');
    const res = await request(app).get(`/api/v1/admin/customers/${userId}/reviews`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET .../reviews lists exactly this customer\'s reviews', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { productId: productA } = await seedVariantWithStock(app, adminToken, 5);
    const { productId: productB } = await seedVariantWithStock(app, adminToken, 5);
    const { token: shopperToken, userId: shopperId } = await registerAndLogin(app, 'customer');
    const { token: otherToken } = await registerAndLogin(app, 'customer');

    await request(app).post('/api/v1/me/reviews').set('Authorization', `Bearer ${shopperToken}`).send({ productId: productA, rating: 4, title: 'A', body: 'x' });
    await request(app).post('/api/v1/me/reviews').set('Authorization', `Bearer ${shopperToken}`).send({ productId: productB, rating: 2, title: 'B', body: 'y' });
    await request(app).post('/api/v1/me/reviews').set('Authorization', `Bearer ${otherToken}`).send({ productId: productA, rating: 5, title: 'C', body: 'z' });

    const res = await request(app).get(`/api/v1/admin/customers/${shopperId}/reviews`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.reviews).toHaveLength(2);
    expect(res.body.data.reviews.every((r: { userId: string }) => r.userId === shopperId)).toBe(true);
  });

  it('GET .../wishlist requires customers.read (403 for a plain customer), and returns wishlist: null with no items yet', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { token: shopperToken, userId: shopperId } = await registerAndLogin(app, 'customer');

    const forbidden = await request(app).get(`/api/v1/admin/customers/${shopperId}/wishlist`).set('Authorization', `Bearer ${shopperToken}`);
    expect(forbidden.status).toBe(403);

    const emptyRes = await request(app).get(`/api/v1/admin/customers/${shopperId}/wishlist`).set('Authorization', `Bearer ${adminToken}`);
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.data.wishlist).toBeNull();
  });

  it('GET .../wishlist returns the real wishlist once the customer has added something', async () => {
    const app = buildApp();
    const { token: adminToken } = await registerAndLogin(app, 'super_admin');
    const { productId } = await seedVariantWithStock(app, adminToken, 5, 18_500);
    const { token: shopperToken, userId: shopperId } = await registerAndLogin(app, 'customer');

    await request(app).post('/api/v1/me/wishlist').set('Authorization', `Bearer ${shopperToken}`).send({ productId });

    const res = await request(app).get(`/api/v1/admin/customers/${shopperId}/wishlist`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.wishlist).not.toBeNull();
    expect(res.body.data.wishlist.items).toHaveLength(1);
    expect(res.body.data.wishlist.items[0].productId).toBe(productId);
    expect(res.body.data.wishlist.items[0].priceAtAddFils).toBe(18_500);
  });
});
