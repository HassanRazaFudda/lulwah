import { Types } from 'mongoose';
import type { QueryFilter, SortOrder } from 'mongoose';
import { CounterModel, OrderModel } from './order.model.js';
import type { OrderDoc, OrderHydratedDoc } from './order.model.js';

/**
 * The ONLY file allowed to touch `OrderModel`/`CounterModel` (plan.md §5.4).
 * `order.service.ts` decides what an order *means*; this file only
 * executes the query it's told to.
 */

/**
 * Order numbers — plan.md §8.6: `LF-YYMMDD-NNNN`, generated via an atomic
 * `findOneAndUpdate` on a per-date counter row, never a naive `count()`
 * (two concurrent placements racing a count-then-format would mint the
 * same number). `$inc` + `upsert: true` is atomic at the Mongo level
 * regardless of how many requests hit it simultaneously — the first one to
 * arrive for a given date creates the row via `$setOnInsert`-equivalent
 * upsert semantics, every subsequent one just increments it.
 */
export async function nextOrderNumber(now: Date = new Date()): Promise<string> {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const dateKey = `${yy}${mm}${dd}`;
  const counter = await CounterModel.findOneAndUpdate({ _id: `order:${dateKey}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' }).exec();
  // findOneAndUpdate with upsert:true always returns a document — the null
  // case only exists at the type level (see inventory.repository.ts's
  // identical comment on its own upsert).
  if (!counter) throw new Error('nextOrderNumber: unexpected null result');
  return `LF-${dateKey}-${String(counter.seq).padStart(4, '0')}`;
}

/** Loosely-typed create input — every id field is a plain string (what
 *  `order.service.ts` actually has, having already resolved snapshots from
 *  other modules' DTOs), not `OrderDoc`'s Mongoose-native `Types.ObjectId`.
 *  Same "normalize at the repository boundary, cast once" pattern as
 *  `product.repository.ts`/`discount.repository.ts`. */
export type CreateOrderInput = Omit<OrderDoc, '_id' | 'createdAt' | 'updatedAt' | 'userId' | 'items' | 'shipments' | 'discounts' | 'refunds' | 'checkoutSessionId'> & {
  userId: string | null;
  items: unknown[];
  shipments?: unknown[];
  discounts?: unknown[];
  refunds?: unknown[];
  checkoutSessionId: string | null;
};

export async function createOrder(input: CreateOrderInput): Promise<OrderHydratedDoc> {
  return OrderModel.create(input as unknown as Parameters<typeof OrderModel.create>[0]);
}

export async function findOrderById(id: string): Promise<OrderHydratedDoc | null> {
  return OrderModel.findOne({ _id: id }).exec();
}

export async function findOrderByOrderNumber(orderNumber: string): Promise<OrderHydratedDoc | null> {
  return OrderModel.findOne({ orderNumber }).exec();
}

export async function findOrderByOrderNumberForUser(orderNumber: string, userId: string): Promise<OrderHydratedDoc | null> {
  return OrderModel.findOne({ orderNumber, userId }).exec();
}

/** `checkout`'s idempotency backstop (see `checkout.service.ts#place`'s
 *  doc comment) — the Mongo-level guarantee behind the Redis-side check. */
export async function findOrderByIdempotencyKey(key: string): Promise<OrderHydratedDoc | null> {
  return OrderModel.findOne({ idempotencyKey: key }).exec();
}

export async function findOrderByPaymentIntentId(intentId: string): Promise<OrderHydratedDoc | null> {
  return OrderModel.findOne({ 'payment.intentId': intentId }).exec();
}

export async function save(doc: OrderHydratedDoc): Promise<OrderHydratedDoc> {
  return doc.save();
}

export interface AdminOrderListFilter {
  status?: OrderDoc['status'] | undefined;
  paymentStatus?: OrderDoc['paymentStatus'] | undefined;
  search?: string | undefined; // matches orderNumber / guestEmail / guestPhone
  userId?: string | undefined;
}

const SORT_SPEC: Record<string, SortOrder> = { createdAt: -1 };

export async function adminListOrders(filter: AdminOrderListFilter, page: number, limit: number): Promise<{ orders: OrderHydratedDoc[]; total: number }> {
  const query: QueryFilter<OrderDoc> = {};
  if (filter.status) query.status = filter.status;
  if (filter.paymentStatus) query.paymentStatus = filter.paymentStatus;
  if (filter.userId) query.userId = filter.userId;
  if (filter.search) {
    const regex = new RegExp(filter.search.trim(), 'i');
    query.$or = [{ orderNumber: regex }, { guestEmail: regex }, { guestPhone: regex }];
  }

  const [orders, total] = await Promise.all([
    OrderModel.find(query)
      .sort(SORT_SPEC)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    OrderModel.countDocuments(query).exec(),
  ]);
  return { orders, total };
}

export async function listOrdersForUser(userId: string, page: number, limit: number): Promise<{ orders: OrderHydratedDoc[]; total: number }> {
  const query: QueryFilter<OrderDoc> = { userId };
  const [orders, total] = await Promise.all([
    OrderModel.find(query)
      .sort(SORT_SPEC)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    OrderModel.countDocuments(query).exec(),
  ]);
  return { orders, total };
}

// ---------------------------------------------------------------------------
// Customer aggregates — `customer` module's exclusive read for plan.md
// §11.1's Customers list/detail (spend, last order, COD risk). Aggregation
// pipelines, not `OrderModel.find()` + JS reduction, so the sum/count/max
// happen in MongoDB rather than pulling every order document over the wire.
// ---------------------------------------------------------------------------

export interface CustomerOrderStatsRaw {
  orderCount: number;
  totalSpentFils: number;
  lastOrderAt: Date | null;
}

/** Orders that count toward a customer's spend/order-count — every status
 *  except the ones that never became (or never stayed) a real sale:
 *  `pending_payment` (payment not yet confirmed), `cancelled`, `failed`.
 *  Deliberately does NOT net out `returned`/`refunded` orders from the
 *  total — those still represent value the customer transacted at the
 *  time; a stricter LTV metric that subtracts refunds is future work, not
 *  built here (see `order.service.ts#getCustomerOrderStats`'s doc
 *  comment). */
const SPEND_COUNTED_STATUSES: OrderDoc['status'][] = [
  'confirmed',
  'processing',
  'stitching',
  'ready_to_ship',
  'shipped',
  'out_for_delivery',
  'delivered',
  'returned',
  'refunded',
];

/** Bulk form — one aggregate query for an entire admin list page (or the
 *  bounded sort-scan batch `customer.service.ts` uses when sorting by
 *  spend/last-order) instead of N+1 single-customer queries. Missing users
 *  (no counted orders at all) simply have no entry in the returned map —
 *  callers default them to zero/`null`. */
export async function getOrderStatsForUsers(userIds: string[]): Promise<Map<string, CustomerOrderStatsRaw>> {
  if (userIds.length === 0) return new Map();
  const rows = await OrderModel.aggregate<{ _id: Types.ObjectId; orderCount: number; totalSpentFils: number; lastOrderAt: Date }>([
    { $match: { userId: { $in: userIds.map((id) => new Types.ObjectId(id)) }, status: { $in: SPEND_COUNTED_STATUSES } } },
    { $group: { _id: '$userId', orderCount: { $sum: 1 }, totalSpentFils: { $sum: '$grandTotalFils' }, lastOrderAt: { $max: '$placedAt' } } },
  ]).exec();
  return new Map(rows.map((r) => [r._id.toString(), { orderCount: r.orderCount, totalSpentFils: r.totalSpentFils, lastOrderAt: r.lastOrderAt }]));
}

// ---------------------------------------------------------------------------
// `engagement` module's exclusive read for `POST /me/reviews`'s server-side
// "isVerifiedPurchase" check (plan.md §5.3: never `OrderModel` directly).
// ---------------------------------------------------------------------------

/** The most recent `delivered` order (if any) placed by `userId` that
 *  contains `productId` — see `order.service.ts#findDeliveredOrderForProduct`
 *  for why `delivered` (not any post-payment status) is the bar. `.sort()`
 *  + a single doc, not a count, since the caller only needs one real
 *  order's id to attach as `Review.orderId`. */
export async function findDeliveredOrderForUserAndProduct(userId: string, productId: string): Promise<{ orderId: string } | null> {
  const order = await OrderModel.findOne({ userId, status: 'delivered', 'items.productId': productId })
    .sort({ deliveredAt: -1 })
    .select('_id')
    .exec();
  return order ? { orderId: order._id.toString() } : null;
}

export interface CustomerCodRiskCounts {
  codOrdersPlaced: number;
  codOrdersCancelled: number;
}

/** plan.md §11.1 "COD risk flags" — see `@lulwah/contracts`' `CustomerCodRisk`
 *  doc comment for what this is (and isn't). One aggregate query grouped
 *  by whether the order was cancelled, rather than two separate counts. */
export async function getCodRiskForUser(userId: string): Promise<CustomerCodRiskCounts> {
  const rows = await OrderModel.aggregate<{ _id: boolean; count: number }>([
    { $match: { userId: new Types.ObjectId(userId), 'payment.method': 'cod' } },
    { $group: { _id: { $eq: ['$status', 'cancelled'] }, count: { $sum: 1 } } },
  ]).exec();
  let codOrdersPlaced = 0;
  let codOrdersCancelled = 0;
  for (const row of rows) {
    codOrdersPlaced += row.count;
    if (row._id) codOrdersCancelled += row.count;
  }
  return { codOrdersPlaced, codOrdersCancelled };
}
