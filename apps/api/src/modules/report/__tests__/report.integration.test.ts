import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Express } from 'express';
import { Types } from 'mongoose';
import { createApp } from '../../../app.js';
import { connect, disconnect } from '../../../shared/mongo.js';
import { InMemoryRateLimitStore } from '../../../shared/rate-limit.js';
import { InMemoryReservationStore } from '../../../modules/cart/reservation-store.js';
import { InMemoryIdempotencyStore } from '../../../modules/checkout/idempotency-store.js';
import { SessionModel, UserModel } from '../../identity/identity.model.js';
import { BrandModel } from '../../catalog/brand.model.js';
import { CategoryModel } from '../../catalog/category.model.js';
import { CollectionModel } from '../../catalog/collection.model.js';
import { ProductModel } from '../../catalog/product.model.js';
import { VariantModel } from '../../catalog/variant.model.js';
import { InventoryItemModel } from '../../inventory/inventory-item.model.js';
import { DiscountModel } from '../../pricing/discount.model.js';
import { OrderModel } from '../../order/order.model.js';
import { SearchQueryLogModel } from '../../catalog/search-query.model.js';

/**
 * Integration coverage for `report` — plan.md §11.1. Orders are seeded
 * directly via `OrderModel.create` (not driven through the real checkout
 * HTTP flow, which `checkout.integration.test.ts` already exercises
 * end-to-end) — this suite's job is proving the REPORT AGGREGATIONS are
 * correct against a known, hand-computed dataset, which needs many
 * orders scattered across dates/emirates/payment methods/discounts that
 * would be prohibitively slow to produce one real checkout at a time.
 *
 * Every expected number below is hand-computed in this file's own doc
 * comments next to the fixture that produces it — see "EXPECTED" comments.
 */

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connect(mongo.getUri());
}, 60_000);

afterAll(async () => {
  await disconnect();
  await mongo.stop();
});

function buildApp(): Express {
  return createApp({ rateLimitStore: new InMemoryRateLimitStore(), reservationStore: new InMemoryReservationStore(), idempotencyStore: new InMemoryIdempotencyStore() });
}

let phoneCounter = 520000000;

async function createUserAndLogin(app: Express, role: 'super_admin' | 'content' | 'customer'): Promise<string> {
  phoneCounter += 1;
  const email = `report-test-${phoneCounter}@example.com`;
  const password = 'correct-horse-battery-staple';
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'A', lastName: 'B', phone: { countryCode: '+971', number: String(phoneCounter) } });
  if (role !== 'customer') await UserModel.updateOne({ email }, { role });
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
  return loginRes.body.data.accessToken as string;
}

function ymString(y: number, monthIndex0: number): string {
  return `${y}-${String(monthIndex0 + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Fixture — one shared dataset for every report, built once.
// ---------------------------------------------------------------------------

const now = new Date();

/** Middle-of-month, noon UTC, `n` calendar months before the current one —
 *  unambiguous month arithmetic, never near a month boundary. */
function monthsAgoMid(n: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 15, 12, 0, 0));
}

/** "Earlier today" — always inside the CURRENT calendar month and always
 *  strictly before `now`, regardless of what day-of-month the suite
 *  happens to run on. */
const recentDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);

const order0Date = monthsAgoMid(4); // User2's actual first order
const order1Date = monthsAgoMid(3); // User1's actual first order
const order2Date = monthsAgoMid(1); // User1's second order
// order3Date / order4Date / order5Date = recentDate ("this month")

let app: Express;
let adminToken: string;
let contentToken: string; // reports.read but NOT reports.write
let customerToken: string; // neither

let productAId: string; // Khaadi / Lawn / in "Eid Edit" collection
let productBId: string; // Asim Jofa / Wedding / no collection
let productCId: string; // never sold
let user1Id: string;
let user2Id: string;
let discountId: string;

beforeAll(async () => {
  app = buildApp();
  await Promise.all([
    UserModel.syncIndexes(),
    SessionModel.syncIndexes(),
    BrandModel.syncIndexes(),
    CategoryModel.syncIndexes(),
    CollectionModel.syncIndexes(),
    ProductModel.syncIndexes(),
    VariantModel.syncIndexes(),
    InventoryItemModel.syncIndexes(),
    OrderModel.syncIndexes(),
  ]);

  [adminToken, contentToken, customerToken] = await Promise.all([createUserAndLogin(app, 'super_admin'), createUserAndLogin(app, 'content'), createUserAndLogin(app, 'customer')]);

  const [khaadi, asim, unsoldBrand] = await Promise.all([
    BrandModel.create({ name: 'Khaadi', slug: `khaadi-${Date.now()}`, countryOfOrigin: 'PK' }),
    BrandModel.create({ name: 'Asim Jofa', slug: `asim-jofa-${Date.now()}`, countryOfOrigin: 'PK' }),
    BrandModel.create({ name: 'Never Sold Co', slug: `never-sold-co-${Date.now()}`, countryOfOrigin: 'PK' }),
  ]);

  const [lawn, wedding] = await Promise.all([
    CategoryModel.create({ name: 'Lawn', slug: `lawn-${Date.now()}`, path: 'lawn', level: 0 }),
    CategoryModel.create({ name: 'Wedding', slug: `wedding-${Date.now()}`, path: 'wedding', level: 0 }),
  ]);

  const productA = await ProductModel.create({
    title: 'Lawn Suit',
    slug: `lawn-suit-${Date.now()}`,
    articleCode: 'KH-001',
    brandId: khaadi._id,
    primaryCategoryId: lawn._id,
    categoryIds: [lawn._id],
    collectionIds: [],
    stitchingType: 'unstitched',
    fabric: 'lawn',
    season: 'summer',
    colorName: 'Ferozi',
    colorFamily: 'blue_ferozi',
    colorHex: '#1f7a8c',
    basePriceFils: 10_000,
    priceRange: { minFils: 10_000, maxFils: 10_000 },
    effectivePriceFils: 10_000,
    status: 'active',
    soldCount: 4, // matches this fixture's real unitsSold below
    totalStock: 20,
  });
  productAId = productA._id.toString();

  const collectionEid = await CollectionModel.create({ name: 'Eid Edit', slug: `eid-edit-${Date.now()}`, type: 'seasonal', productIds: [productA._id] });
  await ProductModel.updateOne({ _id: productA._id }, { collectionIds: [collectionEid._id] });

  const productB = await ProductModel.create({
    title: 'Wedding Set',
    slug: `wedding-set-${Date.now()}`,
    articleCode: 'AJ-002',
    brandId: asim._id,
    primaryCategoryId: wedding._id,
    categoryIds: [wedding._id],
    collectionIds: [],
    stitchingType: 'pret',
    fabric: 'silk',
    season: 'all_season',
    colorName: 'Gold',
    colorFamily: 'gold',
    colorHex: '#caa24b',
    basePriceFils: 15_000,
    priceRange: { minFils: 15_000, maxFils: 15_000 },
    effectivePriceFils: 15_000,
    status: 'active',
    soldCount: 2,
    totalStock: 2,
  });
  productBId = productB._id.toString();

  const productC = await ProductModel.create({
    title: 'Untouched Kurta',
    slug: `untouched-kurta-${Date.now()}`,
    articleCode: 'NS-003',
    brandId: unsoldBrand._id,
    primaryCategoryId: lawn._id,
    categoryIds: [lawn._id],
    stitchingType: 'pret',
    fabric: 'cotton',
    season: 'all_season',
    colorName: 'White',
    colorFamily: 'white',
    colorHex: '#ffffff',
    basePriceFils: 8_000,
    priceRange: { minFils: 8_000, maxFils: 8_000 },
    effectivePriceFils: 8_000,
    status: 'active',
    soldCount: 0,
    totalStock: 5,
  });
  productCId = productC._id.toString();

  // `createdAt` is set directly at creation (not via a follow-up
  // `updateOne`) so this fixture's ageing buckets are exact — Mongoose's
  // `timestamps: true` marks `createdAt` immutable once a document
  // exists, so a later `updateOne({ createdAt })` silently no-ops.
  const [va1, vb1, vc1] = await Promise.all([
    VariantModel.create({ productId: productA._id, sku: 'KH-001-M', priceFils: 10_000, costPriceFils: 6_000, weightGrams: 400, options: { size: 'M' }, createdAt: new Date(now.getTime() - 100 * 86_400_000) }),
    VariantModel.create({ productId: productB._id, sku: 'AJ-002-FREE', priceFils: 15_000, costPriceFils: 9_000, weightGrams: 900, options: { size: 'free' }, createdAt: new Date(now.getTime() - 10 * 86_400_000) }),
    VariantModel.create({ productId: productC._id, sku: 'NS-003-M', priceFils: 8_000, costPriceFils: null, weightGrams: 300, options: { size: 'M' }, createdAt: new Date(now.getTime() - 40 * 86_400_000) }),
  ]);

  await Promise.all([
    InventoryItemModel.create({ variantId: va1._id, productId: productA._id, sku: 'KH-001-M', onHand: 20, reserved: 0, available: 20, lowStockThreshold: 5 }),
    InventoryItemModel.create({ variantId: vb1._id, productId: productB._id, sku: 'AJ-002-FREE', onHand: 2, reserved: 0, available: 2, lowStockThreshold: 5 }),
    InventoryItemModel.create({ variantId: vc1._id, productId: productC._id, sku: 'NS-003-M', onHand: 5, reserved: 0, available: 5, lowStockThreshold: 2 }),
  ]);

  const [user1, user2] = await Promise.all([
    UserModel.create({ email: 'report-user1@example.com', firstName: 'User', lastName: 'One', role: 'customer' }),
    UserModel.create({ email: 'report-user2@example.com', firstName: 'User', lastName: 'Two', role: 'customer' }),
  ]);
  user1Id = user1._id.toString();
  user2Id = user2._id.toString();

  const discount = await DiscountModel.create({ name: 'Eid Sale', mode: 'code', code: 'EID10', type: 'percentage', value: 10, status: 'active' });
  discountId = discount._id.toString();

  const address = {
    label: 'home',
    firstName: 'Test',
    lastName: 'Customer',
    phone: { countryCode: '+971', number: '501234567' },
    city: 'Test City',
    area: 'Test Area',
    buildingName: 'Test Building',
    landmark: 'Near test mall',
    country: 'AE',
  };
  const shippingMethod = { id: 'standard', name: 'Standard', carrier: 'in_house', etaMinDays: 2, etaMaxDays: 4, priceFils: 0 };

  function orderItem(productId: Types.ObjectId, variantId: Types.ObjectId, opts: { sku: string; title: string; brand: string; articleCode: string; unitPriceFils: number; quantity: number }) {
    return {
      productId,
      variantId,
      sku: opts.sku,
      titleSnapshot: opts.title,
      brandSnapshot: opts.brand,
      stitchingTypeSnapshot: 'unstitched',
      articleCodeSnapshot: opts.articleCode,
      quantity: opts.quantity,
      unitPriceFils: opts.unitPriceFils,
      lineDiscountFils: 0,
      lineTaxFils: 0,
      lineTotalFils: opts.unitPriceFils * opts.quantity,
    };
  }

  /** EXPECTED — see this file's class-level doc comment: every number
   *  asserted below is derived directly from these five orders (+
   *  Order5, cancelled, always excluded).
   *
   *  Order0: User2, 4 months ago, delivered, dubai, cod, productB x1 = 15000. No discount.
   *  Order1: User1, 3 months ago, delivered, dubai, cod,   productA x2 = 20000. No discount.
   *  Order2: User1, 1 month ago,  confirmed, dubai, card,  productA x1 = 10000. Discount EID10, amountFils=1000 → grandTotal 9000.
   *  Order3: User2, this month,   confirmed, abu_dhabi, cod, productB x1 = 15000. No discount.
   *  Order4: guest, this month,   processing, sharjah, card, productA x1 (10000) + productB x1 (15000) = 25000.
   *          Discount EID10 applied as TWO item-level entries (1000 + 1500 = 2500 total) — tests the
   *          discounts-report dedup rule (one order's revenue/COGS counted once per discount, not once per entry).
   *          grandTotal 22500.
   *  Order5 (CANCELLED): User1, this month, cancelled, dubai, cod, productA x5 = 50000. Must be excluded everywhere.
   */
  await OrderModel.create([
    {
      orderNumber: 'LF-TEST-0000',
      userId: user2._id,
      guestEmail: null,
      guestPhone: null,
      items: [orderItem(productB._id, vb1._id, { sku: 'AJ-002-FREE', title: 'Wedding Set', brand: 'Asim Jofa', articleCode: 'AJ-002', unitPriceFils: 15_000, quantity: 1 })],
      currency: 'AED',
      subtotalFils: 15_000,
      grandTotalFils: 15_000,
      taxRate: 0,
      status: 'delivered',
      paymentStatus: 'paid',
      fulfilmentStatus: 'fulfilled',
      shippingAddress: { ...address, emirate: 'dubai' },
      billingAddress: { ...address, emirate: 'dubai' },
      shippingMethod,
      payment: { method: 'cod' },
      placedAt: order0Date,
      idempotencyKey: 'report-test-idem-0',
    },
    {
      orderNumber: 'LF-TEST-0001',
      userId: user1._id,
      guestEmail: null,
      guestPhone: null,
      items: [orderItem(productA._id, va1._id, { sku: 'KH-001-M', title: 'Lawn Suit', brand: 'Khaadi', articleCode: 'KH-001', unitPriceFils: 10_000, quantity: 2 })],
      currency: 'AED',
      subtotalFils: 20_000,
      grandTotalFils: 20_000,
      taxRate: 0,
      status: 'delivered',
      paymentStatus: 'paid',
      fulfilmentStatus: 'fulfilled',
      shippingAddress: { ...address, emirate: 'dubai' },
      billingAddress: { ...address, emirate: 'dubai' },
      shippingMethod,
      payment: { method: 'cod' },
      placedAt: order1Date,
      idempotencyKey: 'report-test-idem-1',
    },
    {
      orderNumber: 'LF-TEST-0002',
      userId: user1._id,
      guestEmail: null,
      guestPhone: null,
      items: [orderItem(productA._id, va1._id, { sku: 'KH-001-M', title: 'Lawn Suit', brand: 'Khaadi', articleCode: 'KH-001', unitPriceFils: 10_000, quantity: 1 })],
      currency: 'AED',
      subtotalFils: 10_000,
      discountTotalFils: 1_000,
      grandTotalFils: 9_000,
      discounts: [{ discountId: discount._id, code: 'EID10', type: 'percentage', amountFils: 1_000, appliedTo: 'order', itemId: null }],
      taxRate: 0,
      status: 'confirmed',
      paymentStatus: 'paid',
      fulfilmentStatus: 'unfulfilled',
      shippingAddress: { ...address, emirate: 'dubai' },
      billingAddress: { ...address, emirate: 'dubai' },
      shippingMethod,
      payment: { method: 'card' },
      placedAt: order2Date,
      idempotencyKey: 'report-test-idem-2',
    },
    {
      orderNumber: 'LF-TEST-0003',
      userId: user2._id,
      guestEmail: null,
      guestPhone: null,
      items: [orderItem(productB._id, vb1._id, { sku: 'AJ-002-FREE', title: 'Wedding Set', brand: 'Asim Jofa', articleCode: 'AJ-002', unitPriceFils: 15_000, quantity: 1 })],
      currency: 'AED',
      subtotalFils: 15_000,
      grandTotalFils: 15_000,
      taxRate: 0,
      status: 'confirmed',
      paymentStatus: 'paid',
      fulfilmentStatus: 'unfulfilled',
      shippingAddress: { ...address, emirate: 'abu_dhabi' },
      billingAddress: { ...address, emirate: 'abu_dhabi' },
      shippingMethod,
      payment: { method: 'cod' },
      placedAt: recentDate,
      idempotencyKey: 'report-test-idem-3',
    },
    {
      orderNumber: 'LF-TEST-0004',
      userId: null,
      guestEmail: 'report-guest@example.com',
      guestPhone: null,
      items: [
        orderItem(productA._id, va1._id, { sku: 'KH-001-M', title: 'Lawn Suit', brand: 'Khaadi', articleCode: 'KH-001', unitPriceFils: 10_000, quantity: 1 }),
        orderItem(productB._id, vb1._id, { sku: 'AJ-002-FREE', title: 'Wedding Set', brand: 'Asim Jofa', articleCode: 'AJ-002', unitPriceFils: 15_000, quantity: 1 }),
      ],
      currency: 'AED',
      subtotalFils: 25_000,
      discountTotalFils: 2_500,
      grandTotalFils: 22_500,
      discounts: [
        { discountId: discount._id, code: 'EID10', type: 'percentage', amountFils: 1_000, appliedTo: 'item', itemId: null },
        { discountId: discount._id, code: 'EID10', type: 'percentage', amountFils: 1_500, appliedTo: 'item', itemId: null },
      ],
      taxRate: 0,
      status: 'processing',
      paymentStatus: 'paid',
      fulfilmentStatus: 'unfulfilled',
      shippingAddress: { ...address, emirate: 'sharjah' },
      billingAddress: { ...address, emirate: 'sharjah' },
      shippingMethod,
      payment: { method: 'card' },
      placedAt: recentDate,
      idempotencyKey: 'report-test-idem-4',
    },
    {
      orderNumber: 'LF-TEST-0005',
      userId: user1._id,
      guestEmail: null,
      guestPhone: null,
      items: [orderItem(productA._id, va1._id, { sku: 'KH-001-M', title: 'Lawn Suit', brand: 'Khaadi', articleCode: 'KH-001', unitPriceFils: 10_000, quantity: 5 })],
      currency: 'AED',
      subtotalFils: 50_000,
      grandTotalFils: 50_000,
      taxRate: 0,
      status: 'cancelled',
      paymentStatus: 'refunded',
      fulfilmentStatus: 'unfulfilled',
      shippingAddress: { ...address, emirate: 'dubai' },
      billingAddress: { ...address, emirate: 'dubai' },
      shippingMethod,
      payment: { method: 'cod' },
      placedAt: recentDate,
      idempotencyKey: 'report-test-idem-5',
      cancelledAt: recentDate,
      cancelReason: 'test',
    },
  ]);

  await Promise.all([
    SearchQueryLogModel.create({ query: 'zzz-no-match', normalizedQuery: 'zzz-no-match', resultCount: 0, source: 'mongo_fallback' }),
    SearchQueryLogModel.create({ query: 'zzz-no-match', normalizedQuery: 'zzz-no-match', resultCount: 0, source: 'mongo_fallback' }),
    SearchQueryLogModel.create({ query: 'zzz-no-match', normalizedQuery: 'zzz-no-match', resultCount: 0, source: 'mongo_fallback' }),
    SearchQueryLogModel.create({ query: 'Lawn Suit', normalizedQuery: 'lawn suit', resultCount: 3, source: 'mongo_fallback' }),
    SearchQueryLogModel.create({ query: 'lawn suit', normalizedQuery: 'lawn suit', resultCount: 3, source: 'mongo_fallback' }),
    SearchQueryLogModel.create({ query: 'wedding', normalizedQuery: 'wedding', resultCount: 1, source: 'mongo_fallback' }),
  ]);
}, 60_000);

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

describe('RBAC', () => {
  it('401s with no token at all', async () => {
    const res = await request(app).get('/api/v1/admin/reports/sales');
    expect(res.status).toBe(401);
  });

  it('403s a role without reports.read', async () => {
    const res = await request(app).get('/api/v1/admin/reports/sales').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('a role with reports.read but not reports.write gets JSON fine but is refused a CSV export', async () => {
    const jsonRes = await request(app).get('/api/v1/admin/reports/sales').set('Authorization', `Bearer ${contentToken}`);
    expect(jsonRes.status).toBe(200);

    const csvRes = await request(app).get('/api/v1/admin/reports/sales?format=csv').set('Authorization', `Bearer ${contentToken}`);
    expect(csvRes.status).toBe(403);
  });

  it('super_admin can export CSV — real headers, real content-type, real BOM', async () => {
    const res = await request(app).get('/api/v1/admin/reports/sales?format=csv&groupBy=emirate').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    expect(res.text).toContain('Dubai');
  });
});

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

describe('GET /admin/reports/sales', () => {
  it('totals exclude the cancelled order entirely', async () => {
    const res = await request(app).get('/api/v1/admin/reports/sales').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { totals } = res.body.data.report;
    // 5 non-cancelled orders: Order0 (15000) + Order1 (20000) + Order2 (9000)
    // + Order3 (15000) + Order4 (22500) — Order5 (cancelled) excluded.
    expect(totals.ordersCount).toBe(5);
    expect(totals.unitsSold).toBe(7); // 1 + 2 + 1 + 1 + (1+1)
    expect(totals.subtotalFils).toBe(85_000);
    expect(totals.discountFils).toBe(3_500);
    expect(totals.grandTotalFils).toBe(81_500);
  });

  it('groups by emirate correctly, including a three-order bucket', async () => {
    const res = await request(app).get('/api/v1/admin/reports/sales?groupBy=emirate').set('Authorization', `Bearer ${adminToken}`);
    const rows: { key: string; ordersCount: number; unitsSold: number; grandTotalFils: number }[] = res.body.data.report.rows;
    // dubai: Order0 (15000) + Order1 (20000) + Order2 (9000)
    const dubai = rows.find((r) => r.key === 'dubai');
    expect(dubai).toMatchObject({ ordersCount: 3, unitsSold: 4, grandTotalFils: 44_000 });
    const abuDhabi = rows.find((r) => r.key === 'abu_dhabi');
    expect(abuDhabi).toMatchObject({ ordersCount: 1, unitsSold: 1, grandTotalFils: 15_000 });
    const sharjah = rows.find((r) => r.key === 'sharjah');
    expect(sharjah).toMatchObject({ ordersCount: 1, unitsSold: 2, grandTotalFils: 22_500 });
  });

  it('groups by payment method correctly', async () => {
    const res = await request(app).get('/api/v1/admin/reports/sales?groupBy=paymentMethod').set('Authorization', `Bearer ${adminToken}`);
    const rows: { key: string; ordersCount: number; grandTotalFils: number }[] = res.body.data.report.rows;
    // cod: Order0 (15000) + Order1 (20000) + Order3 (15000)
    expect(rows.find((r) => r.key === 'cod')).toMatchObject({ ordersCount: 3, grandTotalFils: 50_000 });
    expect(rows.find((r) => r.key === 'card')).toMatchObject({ ordersCount: 2, grandTotalFils: 31_500 });
  });

  it('groups by brand at line-item level (one order touching two brands contributes to both)', async () => {
    const res = await request(app).get('/api/v1/admin/reports/sales?groupBy=brand').set('Authorization', `Bearer ${adminToken}`);
    const rows: { key: string; ordersCount: number; unitsSold: number; revenueFils?: number; grandTotalFils: number }[] = res.body.data.report.rows;
    const khaadi = rows.find((r) => r.key === 'Khaadi');
    expect(khaadi).toMatchObject({ ordersCount: 3, unitsSold: 4, grandTotalFils: 40_000 });
    // Asim Jofa (productB): Order0 (15000) + Order3 (15000) + Order4 (15000)
    const asim = rows.find((r) => r.key === 'Asim Jofa');
    expect(asim).toMatchObject({ ordersCount: 3, unitsSold: 3, grandTotalFils: 45_000 });
  });

  it('groups by category via the documented catalog $lookup crossing', async () => {
    const res = await request(app).get('/api/v1/admin/reports/sales?groupBy=category').set('Authorization', `Bearer ${adminToken}`);
    const rows: { label: string; ordersCount: number; unitsSold: number; grandTotalFils: number }[] = res.body.data.report.rows;
    expect(rows.find((r) => r.label === 'Lawn')).toMatchObject({ ordersCount: 3, unitsSold: 4, grandTotalFils: 40_000 });
    expect(rows.find((r) => r.label === 'Wedding')).toMatchObject({ ordersCount: 3, unitsSold: 3, grandTotalFils: 45_000 });
  });

  it('groups by collection, fanning a product into every collection it belongs to', async () => {
    const res = await request(app).get('/api/v1/admin/reports/sales?groupBy=collection').set('Authorization', `Bearer ${adminToken}`);
    const rows: { label: string; unitsSold: number; grandTotalFils: number }[] = res.body.data.report.rows;
    expect(rows.find((r) => r.label === 'Eid Edit')).toMatchObject({ unitsSold: 4, grandTotalFils: 40_000 });
    expect(rows.find((r) => r.label === 'No collection')).toMatchObject({ unitsSold: 3, grandTotalFils: 45_000 });
  });
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

describe('GET /admin/reports/products', () => {
  it('ranks best/worst sellers by real order data and lists never-sold products', async () => {
    const res = await request(app).get('/api/v1/admin/reports/products').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const report = res.body.data.report;

    expect(report.bestSellers[0]).toMatchObject({ productId: productAId, unitsSold: 4, revenueFils: 40_000 });
    // productB: Order0 (15000) + Order3 (15000) + Order4 (15000)
    expect(report.worstSellers[0]).toMatchObject({ productId: productBId, unitsSold: 3, revenueFils: 45_000 });

    // sellThroughRate = unitsSold / (unitsSold + currentStock)
    const productARow = report.bestSellers.find((r: { productId: string }) => r.productId === productAId);
    expect(productARow.currentStock).toBe(20);
    expect(productARow.sellThroughRate).toBeCloseTo(4 / 24, 5);

    expect(report.neverSoldCount).toBeGreaterThanOrEqual(1);
    const neverSoldRow = report.neverSold.find((r: { productId: string }) => r.productId === productCId);
    expect(neverSoldRow).toBeTruthy();
    expect(neverSoldRow.brandName).toBe('Never Sold Co');
  });
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

describe('GET /admin/reports/customers', () => {
  it('splits new vs. returning for a "this month" window', async () => {
    const dateFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const res = await request(app).get(`/api/v1/admin/reports/customers?dateFrom=${dateFrom}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const report = res.body.data.report;

    // User2 ordered this month (Order3) but their real first order was 4
    // months ago (Order0) => returning.
    expect(report.returningCustomers).toMatchObject({ customers: 1, ordersCount: 1, revenueFils: 15_000 });
    // The guest's only order ever (Order4) is this month => new.
    expect(report.newCustomers).toMatchObject({ customers: 1, ordersCount: 1, revenueFils: 22_500 });
  });

  it('computes LTV correctly across each customer’s full order history', async () => {
    const res = await request(app).get('/api/v1/admin/reports/customers?limit=10').set('Authorization', `Bearer ${adminToken}`);
    const report = res.body.data.report;
    const byKey = new Map(report.topCustomersByLtv.map((r: { customerKey: string }) => [r.customerKey, r]));

    const user1Row = byKey.get(`user:${user1Id}`) as { totalSpentFils: number; ordersCount: number; name: string } | undefined;
    expect(user1Row).toMatchObject({ totalSpentFils: 29_000, ordersCount: 2, name: 'User One' }); // Order1 (20000) + Order2 (9000); Order5 cancelled, excluded

    const user2Row = byKey.get(`user:${user2Id}`) as { totalSpentFils: number; ordersCount: number } | undefined;
    expect(user2Row).toMatchObject({ totalSpentFils: 30_000, ordersCount: 2 }); // Order0 (15000) + Order3 (15000)

    const guestRow = byKey.get('guest:report-guest@example.com') as { totalSpentFils: number; ordersCount: number; name: string; email: string } | undefined;
    expect(guestRow).toMatchObject({ totalSpentFils: 22_500, ordersCount: 1, name: 'Guest', email: 'report-guest@example.com' });

    // Only registered users (User1/User2) and the guest placed real orders
    // in this fixture, but other `describe` blocks above also registered
    // login-only users with zero orders (excluded from `lifetime` stats,
    // which is built from `orders`, not `users`) — assert the specific top
    // rows above instead of a brittle exact average.
    expect(report.averageLtvFils).toBeGreaterThan(0);
  });

  it('builds cohort retention from real first-order months', async () => {
    const res = await request(app).get('/api/v1/admin/reports/customers').set('Authorization', `Bearer ${adminToken}`);
    const report = res.body.data.report;
    const cohortMonth = ymString(order1Date.getUTCFullYear(), order1Date.getUTCMonth());
    const cohort = report.cohorts.find((c: { cohortMonth: string }) => c.cohortMonth === cohortMonth);
    expect(cohort).toBeTruthy();
    expect(cohort.cohortSize).toBe(1); // only User1 first-ordered in that month in this fixture

    const offset0 = cohort.retention.find((r: { monthOffset: number }) => r.monthOffset === 0);
    expect(offset0).toMatchObject({ activeCustomers: 1, retentionRate: 1 });
    const offset2 = cohort.retention.find((r: { monthOffset: number }) => r.monthOffset === 2);
    // 3 months ago + 2 = 1 month ago, exactly Order2's month.
    expect(offset2).toMatchObject({ activeCustomers: 1, retentionRate: 1 });
    const offset1 = cohort.retention.find((r: { monthOffset: number }) => r.monthOffset === 1);
    expect(offset1).toMatchObject({ activeCustomers: 0, retentionRate: 0 });
  });
});

// ---------------------------------------------------------------------------
// Discounts
// ---------------------------------------------------------------------------

describe('GET /admin/reports/discounts', () => {
  it('dedupes an order with multiple entries for the same discount, and computes a real margin estimate', async () => {
    const res = await request(app).get('/api/v1/admin/reports/discounts').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const rows: { discountId: string; name: string; code: string; ordersCount: number; discountGivenFils: number; revenueFils: number; estimatedMarginImpactFils: number }[] = res.body.data.report.rows;
    const row = rows.find((r) => r.discountId === discountId);
    expect(row).toBeTruthy();
    expect(row).toMatchObject({
      name: 'Eid Sale',
      code: 'EID10',
      ordersCount: 2, // Order2 + Order4 — Order4's TWO entries must not double-count
      discountGivenFils: 3_500, // 1000 + (1000 + 1500)
      revenueFils: 31_500, // 9000 + 22500, each order's grandTotal counted exactly once
      // COGS: Order2 (productA x1 @ cost 6000) + Order4 (productA x1 @ 6000 + productB x1 @ 9000) = 21000
      estimatedMarginImpactFils: 10_500,
    });
  });
});

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

describe('GET /admin/reports/inventory', () => {
  it('computes stock value, ageing buckets, and the low-stock list from real inventory + variant cost', async () => {
    const res = await request(app).get('/api/v1/admin/reports/inventory').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const report = res.body.data.report;

    expect(report.totalUnitsOnHand).toBe(27); // 20 + 2 + 5
    expect(report.totalValueAtCostFils).toBe(138_000); // 20*6000 + 2*9000 + 5*0(null cost)
    expect(report.totalValueAtRetailFils).toBe(270_000); // 20*10000 + 2*15000 + 5*8000

    const bucket90plus = report.ageing.find((b: { bucket: string }) => b.bucket === '90_plus');
    expect(bucket90plus).toMatchObject({ variantCount: 1, unitsOnHand: 20, valueAtCostFils: 120_000 });
    const bucket0_30 = report.ageing.find((b: { bucket: string }) => b.bucket === '0_30');
    expect(bucket0_30).toMatchObject({ variantCount: 1, unitsOnHand: 2, valueAtCostFils: 18_000 });
    const bucket31_60 = report.ageing.find((b: { bucket: string }) => b.bucket === '31_60');
    expect(bucket31_60).toMatchObject({ variantCount: 1, unitsOnHand: 5, valueAtCostFils: 0 });

    expect(report.lowStockCount).toBe(1);
    expect(report.lowStock[0]).toMatchObject({ sku: 'AJ-002-FREE', onHand: 2, lowStockThreshold: 5 });
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

describe('GET /admin/reports/search', () => {
  it('reports real logged query data — top queries and zero-result queries', async () => {
    const res = await request(app).get('/api/v1/admin/reports/search').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const report = res.body.data.report;

    const zero = report.zeroResultQueries.find((r: { query: string }) => r.query.toLowerCase() === 'zzz-no-match');
    expect(zero).toMatchObject({ searchCount: 3, avgResultCount: 0 });

    const lawnQuery = report.topQueries.find((r: { query: string }) => r.query.toLowerCase() === 'lawn suit');
    expect(lawnQuery).toMatchObject({ searchCount: 2, avgResultCount: 3 });
  });

  it('the real GET /search endpoint actually logs a query the report can then see', async () => {
    await request(app).get('/api/v1/search?q=SmokeTestQueryXYZ');
    // Logging is fire-and-forget (search.service.ts's own doc comment) —
    // give the in-memory write a moment to land before asserting.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const res = await request(app).get('/api/v1/admin/reports/search?limit=50').set('Authorization', `Bearer ${adminToken}`);
    const report = res.body.data.report;
    const all = [...report.topQueries, ...report.zeroResultQueries];
    expect(all.some((r: { query: string }) => r.query.toLowerCase() === 'smoketestqueryxyz')).toBe(true);
  });
});
