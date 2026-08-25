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
export type CreateOrderInput = Omit<OrderDoc, '_id' | 'createdAt' | 'updatedAt' | 'userId' | 'items' | 'shipments' | 'discounts' | 'checkoutSessionId'> & {
  userId: string | null;
  items: unknown[];
  shipments?: unknown[];
  discounts?: unknown[];
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
