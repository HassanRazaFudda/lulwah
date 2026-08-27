import type { PipelineStage, QueryFilter } from 'mongoose';
import { OrderModel } from '../order/order.model.js';
import type { OrderDoc } from '../order/order.model.js';
import { ProductModel } from '../catalog/product.model.js';
import { CategoryModel } from '../catalog/category.model.js';
import { CollectionModel } from '../catalog/collection.model.js';
import type { SalesReportGroupBy } from '@lulwah/contracts';

/**
 * ============================================================================
 * MODULE-BOUNDARY EXCEPTION — plan.md §5.3's "cross-module calls only via
 * another module's exported service function" is relaxed here, per the
 * `report` module's own brief: reports are inherently cross-cutting
 * read-only aggregations, and no `order`/`catalog`-exported service
 * function can answer "revenue grouped by day/category/collection" without
 * `report` re-implementing a second aggregation engine on top of them.
 * This file reads `OrderModel` directly (read-only — never a write), and
 * for `category`/`collection` grouping, `$lookup`s into `products`/
 * `categories`/`collections` by their well-known collection names. No
 * other file in `report` reaches into another module's model for
 * anything a plain exported function could already answer — see
 * `products.repository.ts`, `inventory.repository.ts`, etc. for the
 * contrast (those compose exported service calls instead).
 * ============================================================================
 */

export interface SalesReportRawRow {
  key: string;
  label: string;
  ordersCount: number;
  unitsSold: number;
  subtotalFils: number;
  discountFils: number;
  grandTotalFils: number;
}

export interface SalesReportTotalsRaw {
  ordersCount: number;
  unitsSold: number;
  subtotalFils: number;
  discountFils: number;
  grandTotalFils: number;
}

/** "Sales" excludes `cancelled` orders — a cancelled order was never a
 *  real sale (plan.md §8.7.3: cancellation restocks and reverses discount
 *  usage). Every other status (including `pending_payment`) still counts:
 *  a COD order is `pending_payment` only for the seconds between OTP
 *  verification and its auto-confirm event, so excluding it would
 *  silently under-report same-day COD sales in a report queried
 *  mid-request; a placed-but-not-yet-confirmed card order is rarer but
 *  the same logic applies. Documented interpretation, not a plan.md
 *  literal transcription (the plan doesn't specify this).
 *
 *  Exported so `products.repository.ts`/`discounts.repository.ts` share
 *  this exact same "what counts as a real sale" definition instead of
 *  each re-deriving it slightly differently. */
export function buildSalesMatch(dateFrom: Date | undefined, dateTo: Date | undefined): QueryFilter<OrderDoc> {
  const match: QueryFilter<OrderDoc> = { status: { $ne: 'cancelled' } };
  if (dateFrom || dateTo) {
    match.placedAt = {};
    if (dateFrom) match.placedAt.$gte = dateFrom;
    if (dateTo) match.placedAt.$lte = dateTo;
  }
  return match;
}

/** The true period totals — one order counted exactly once, regardless of
 *  `groupBy`. Used as `SalesReportResponse.totals`, deliberately computed
 *  independently of `rows` (see that field's own doc comment in
 *  `@lulwah/contracts` for why `rows` can legitimately sum to more than
 *  this for `brand`/`category`/`collection`). */
export async function getSalesTotals(dateFrom: Date | undefined, dateTo: Date | undefined): Promise<SalesReportTotalsRaw> {
  const rows = await OrderModel.aggregate<SalesReportTotalsRaw & { _id: null }>([
    { $match: buildSalesMatch(dateFrom, dateTo) },
    {
      $group: {
        _id: null,
        ordersCount: { $sum: 1 },
        unitsSold: { $sum: { $sum: '$items.quantity' } },
        subtotalFils: { $sum: '$subtotalFils' },
        discountFils: { $sum: '$discountTotalFils' },
        grandTotalFils: { $sum: '$grandTotalFils' },
      },
    },
  ]).exec();
  const row = rows[0];
  return row
    ? { ordersCount: row.ordersCount, unitsSold: row.unitsSold, subtotalFils: row.subtotalFils, discountFils: row.discountFils, grandTotalFils: row.grandTotalFils }
    : { ordersCount: 0, unitsSold: 0, subtotalFils: 0, discountFils: 0, grandTotalFils: 0 };
}

/** Order-level groupings — one group key per order, no line-item fan-out,
 *  so `$sum` over an array field (`items.quantity`) is safe: it sums that
 *  one document's own array, then the outer `$group` accumulator sums
 *  across documents in the bucket (a documented MongoDB `$sum` operator
 *  behavior since 3.2, not a bug). */
async function aggregateOrderLevel(groupExpr: Record<string, unknown> | string, dateFrom: Date | undefined, dateTo: Date | undefined): Promise<SalesReportRawRow[]> {
  const rows = await OrderModel.aggregate<{ _id: string; ordersCount: number; unitsSold: number; subtotalFils: number; discountFils: number; grandTotalFils: number }>([
    { $match: buildSalesMatch(dateFrom, dateTo) },
    {
      $group: {
        _id: groupExpr,
        ordersCount: { $sum: 1 },
        unitsSold: { $sum: { $sum: '$items.quantity' } },
        subtotalFils: { $sum: '$subtotalFils' },
        discountFils: { $sum: '$discountTotalFils' },
        grandTotalFils: { $sum: '$grandTotalFils' },
      },
    },
    { $sort: { _id: 1 } },
  ]).exec();
  return rows.map((r) => ({ key: r._id, label: r._id, ordersCount: r.ordersCount, unitsSold: r.unitsSold, subtotalFils: r.subtotalFils, discountFils: r.discountFils, grandTotalFils: r.grandTotalFils }));
}

/** Item-level groupings (`brand`) — one group key per order LINE, which is
 *  exactly what "revenue by brand" means (an order touching two brands
 *  contributes a line to each). Uses `items.brandSnapshot` — already
 *  embedded on every order item at checkout time (plan.md §7.11's
 *  snapshot rule) — so this needs no `$lookup` into `catalog` at all. */
async function aggregateByBrand(dateFrom: Date | undefined, dateTo: Date | undefined): Promise<SalesReportRawRow[]> {
  const rows = await OrderModel.aggregate<{ _id: string; ordersCount: number; unitsSold: number; subtotalFils: number; discountFils: number; grandTotalFils: number }>([
    { $match: buildSalesMatch(dateFrom, dateTo) },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.brandSnapshot',
        orderIds: { $addToSet: '$_id' },
        unitsSold: { $sum: '$items.quantity' },
        subtotalFils: { $sum: { $multiply: ['$items.unitPriceFils', '$items.quantity'] } },
        discountFils: { $sum: '$items.lineDiscountFils' },
        grandTotalFils: { $sum: '$items.lineTotalFils' },
      },
    },
    { $project: { _id: 1, ordersCount: { $size: '$orderIds' }, unitsSold: 1, subtotalFils: 1, discountFils: 1, grandTotalFils: 1 } },
    { $sort: { grandTotalFils: -1 } },
  ]).exec();
  return rows.map((r) => ({ key: r._id, label: r._id, ordersCount: r.ordersCount, unitsSold: r.unitsSold, subtotalFils: r.subtotalFils, discountFils: r.discountFils, grandTotalFils: r.grandTotalFils }));
}

/** Item-level grouping by category/collection — the one real crossing
 *  into `catalog`'s collections in this file. Order items don't snapshot
 *  category/collection membership (only brand/title/SKU, plan.md §7.11),
 *  so there is no way to answer "sales by category" from `orders` alone. */
async function aggregateByProductJoin(kind: 'category' | 'collection', dateFrom: Date | undefined, dateTo: Date | undefined): Promise<SalesReportRawRow[]> {
  const pipeline: PipelineStage[] = [
    { $match: buildSalesMatch(dateFrom, dateTo) },
    { $unwind: '$items' },
    { $lookup: { from: ProductModel.collection.name, localField: 'items.productId', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
  ];

  if (kind === 'category') {
    // One `primaryCategoryId` per product — a plain 1:1 join, no fan-out.
    pipeline.push(
      { $lookup: { from: CategoryModel.collection.name, localField: 'product.primaryCategoryId', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$category._id', null] },
          label: { $first: { $ifNull: ['$category.name', 'Uncategorized'] } },
          orderIds: { $addToSet: '$_id' },
          unitsSold: { $sum: '$items.quantity' },
          subtotalFils: { $sum: { $multiply: ['$items.unitPriceFils', '$items.quantity'] } },
          discountFils: { $sum: '$items.lineDiscountFils' },
          grandTotalFils: { $sum: '$items.lineTotalFils' },
        },
      },
    );
  } else {
    // `collectionIds` is an array — unwinding is a deliberate fan-out, not
    // a bug: a product in two collections should credit both (documented
    // on `SalesReportResponse.rows` in `@lulwah/contracts`).
    pipeline.push(
      { $unwind: { path: '$product.collectionIds', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: CollectionModel.collection.name, localField: 'product.collectionIds', foreignField: '_id', as: 'collection' } },
      { $unwind: { path: '$collection', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$collection._id', null] },
          label: { $first: { $ifNull: ['$collection.name', 'No collection'] } },
          orderIds: { $addToSet: '$_id' },
          unitsSold: { $sum: '$items.quantity' },
          subtotalFils: { $sum: { $multiply: ['$items.unitPriceFils', '$items.quantity'] } },
          discountFils: { $sum: '$items.lineDiscountFils' },
          grandTotalFils: { $sum: '$items.lineTotalFils' },
        },
      },
    );
  }

  pipeline.push(
    { $project: { _id: 1, label: 1, ordersCount: { $size: '$orderIds' }, unitsSold: 1, subtotalFils: 1, discountFils: 1, grandTotalFils: 1 } },
    { $sort: { grandTotalFils: -1 } },
  );

  const rows = await OrderModel.aggregate<{ _id: unknown; label: string; ordersCount: number; unitsSold: number; subtotalFils: number; discountFils: number; grandTotalFils: number }>(pipeline).exec();
  return rows.map((r) => ({
    key: r._id === null ? 'none' : String(r._id),
    label: r.label,
    ordersCount: r.ordersCount,
    unitsSold: r.unitsSold,
    subtotalFils: r.subtotalFils,
    discountFils: r.discountFils,
    grandTotalFils: r.grandTotalFils,
  }));
}

export async function getSalesRows(groupBy: SalesReportGroupBy, dateFrom: Date | undefined, dateTo: Date | undefined): Promise<SalesReportRawRow[]> {
  switch (groupBy) {
    case 'day':
      return aggregateOrderLevel({ $dateToString: { format: '%Y-%m-%d', date: '$placedAt', timezone: 'Asia/Dubai' } }, dateFrom, dateTo);
    case 'emirate':
      return aggregateOrderLevel('$shippingAddress.emirate', dateFrom, dateTo);
    case 'paymentMethod':
      return aggregateOrderLevel('$payment.method', dateFrom, dateTo);
    case 'brand':
      return aggregateByBrand(dateFrom, dateTo);
    case 'category':
      return aggregateByProductJoin('category', dateFrom, dateTo);
    case 'collection':
      return aggregateByProductJoin('collection', dateFrom, dateTo);
  }
}
