import { OrderModel } from '../order/order.model.js';
import { buildSalesMatch } from './sales.repository.js';

/**
 * Best/worst sellers — plan.md §11.1. Unlike `sales.repository.ts`'s
 * `category`/`collection` grouping, this needs NO `$lookup` into
 * `catalog`: `titleSnapshot`/`brandSnapshot`/`articleCodeSnapshot` are
 * already embedded on every order item (plan.md §7.11's snapshot rule),
 * so grouping by `items.productId` and reading the snapshot fields
 * answers "best sellers in this date range" entirely from `orders`. This
 * file still reads `OrderModel` directly — the same documented
 * `report`-only exception as `sales.repository.ts` (plan.md §5.3) — but
 * needs no cross-collection join to do it.
 *
 * "Never sold" is NOT here — that's a lifetime, not date-ranged,
 * question answered by `catalog`'s own `soldCount` field, via the small
 * exported `product.service.ts#getNeverSoldProducts` (see
 * `report.service.ts`) rather than a raw aggregation at all.
 */
export interface ProductPerformanceRawRow {
  productId: string;
  title: string;
  articleCode: string;
  brandName: string;
  unitsSold: number;
  revenueFils: number;
}

async function aggregateProductPerformance(dateFrom: Date | undefined, dateTo: Date | undefined, limit: number, sortDir: 1 | -1): Promise<ProductPerformanceRawRow[]> {
  const rows = await OrderModel.aggregate<{ _id: unknown; title: string; articleCode: string; brandName: string; unitsSold: number; revenueFils: number }>([
    { $match: buildSalesMatch(dateFrom, dateTo) },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        title: { $last: '$items.titleSnapshot' },
        articleCode: { $last: '$items.articleCodeSnapshot' },
        brandName: { $last: '$items.brandSnapshot' },
        unitsSold: { $sum: '$items.quantity' },
        revenueFils: { $sum: '$items.lineTotalFils' },
      },
    },
    { $sort: { unitsSold: sortDir } },
    { $limit: limit },
  ]).exec();
  return rows.map((r) => ({ productId: String(r._id), title: r.title, articleCode: r.articleCode, brandName: r.brandName, unitsSold: r.unitsSold, revenueFils: r.revenueFils }));
}

export async function getBestSellers(dateFrom: Date | undefined, dateTo: Date | undefined, limit: number): Promise<ProductPerformanceRawRow[]> {
  return aggregateProductPerformance(dateFrom, dateTo, limit, -1);
}

export async function getWorstSellers(dateFrom: Date | undefined, dateTo: Date | undefined, limit: number): Promise<ProductPerformanceRawRow[]> {
  return aggregateProductPerformance(dateFrom, dateTo, limit, 1);
}
