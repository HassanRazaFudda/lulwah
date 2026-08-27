import { OrderModel } from '../order/order.model.js';
import { buildSalesMatch } from './sales.repository.js';

/**
 * Customers report — plan.md §11.1: "new vs returning, cohort retention,
 * LTV." Same documented `report`-only exception as `sales.repository.ts`
 * (plan.md §5.3): this reads `OrderModel` directly, read-only, because no
 * exported `order` service function can answer "group all orders by
 * customer" without `report` reimplementing that aggregation on top of
 * one that already returns individual orders.
 *
 * `identity`'s `User.stats` (orderCount/totalSpentFils/...) exists on the
 * schema but nothing writes to it (see `identity.model.ts`'s own doc
 * comment: "kept as inert placeholders... `stats` needs `order`" — still
 * true, `order.service.ts`'s confirmation side effects never touch it).
 * Computing straight from `orders` here is not a workaround for that gap
 * — it's the more correct source anyway: `orders` is the ledger of what
 * actually happened, is guaranteed to include guests (who have no `User`
 * row at all), and this report needs `activeMonths`/date-scoped
 * behaviour `User.stats`'s four scalar fields could never carry.
 *
 * A customer is keyed `user:<id>` when `Order.userId` is set, else
 * `guest:<email>` (guest checkout requires an email — plan.md §15.6 "no
 * forced account creation," `guestPhone` is the fallback for the
 * vanishingly rare row missing even that).
 */

const CUSTOMER_KEY_EXPR = {
  $cond: [
    { $ne: ['$userId', null] },
    { $concat: ['user:', { $toString: '$userId' }] },
    { $concat: ['guest:', { $toLower: { $ifNull: ['$guestEmail', { $ifNull: ['$guestPhone', 'unknown'] }] } }] },
  ],
};

export interface CustomerLifetimeStatsRaw {
  customerKey: string;
  userId: string | null;
  guestEmail: string | null;
  firstOrderAt: Date;
  lastOrderAt: Date;
  ordersCount: number;
  totalSpentFils: number;
  /** Distinct `YYYY-MM` (Asia/Dubai) months this customer placed at
   *  least one order in — the input to cohort retention. */
  activeMonths: string[];
}

/** All-time per-customer stats — LTV and cohort retention are inherently
 *  lifetime measures, not date-windowed (see `CustomersReportResponse`'s
 *  doc comment in `@lulwah/contracts`). */
export async function getCustomerLifetimeStats(): Promise<CustomerLifetimeStatsRaw[]> {
  const rows = await OrderModel.aggregate<{ _id: string; userId: unknown; guestEmail: string | null; firstOrderAt: Date; lastOrderAt: Date; ordersCount: number; totalSpentFils: number; activeMonths: string[] }>([
    { $match: { status: { $ne: 'cancelled' } } },
    { $addFields: { customerKey: CUSTOMER_KEY_EXPR, orderMonth: { $dateToString: { format: '%Y-%m', date: '$placedAt', timezone: 'Asia/Dubai' } } } },
    {
      $group: {
        _id: '$customerKey',
        userId: { $first: '$userId' },
        guestEmail: { $first: '$guestEmail' },
        firstOrderAt: { $min: '$placedAt' },
        lastOrderAt: { $max: '$placedAt' },
        ordersCount: { $sum: 1 },
        totalSpentFils: { $sum: '$grandTotalFils' },
        activeMonths: { $addToSet: '$orderMonth' },
      },
    },
  ]).exec();
  return rows.map((r) => ({
    customerKey: r._id,
    userId: r.userId ? String(r.userId) : null,
    guestEmail: r.guestEmail,
    firstOrderAt: r.firstOrderAt,
    lastOrderAt: r.lastOrderAt,
    ordersCount: r.ordersCount,
    totalSpentFils: r.totalSpentFils,
    activeMonths: r.activeMonths,
  }));
}

export interface CustomerRangeStatsRaw {
  customerKey: string;
  ordersCountInRange: number;
  revenueInRangeFils: number;
}

/** Which customers ordered inside the requested window, and how much —
 *  combined in `report.service.ts` with `getCustomerLifetimeStats`'s
 *  `firstOrderAt` to decide new vs. returning (a customer is "new" for
 *  this window iff their lifetime first order falls inside it). */
export async function getCustomerRangeStats(dateFrom: Date | undefined, dateTo: Date | undefined): Promise<CustomerRangeStatsRaw[]> {
  const rows = await OrderModel.aggregate<{ _id: string; ordersCountInRange: number; revenueInRangeFils: number }>([
    { $match: buildSalesMatch(dateFrom, dateTo) },
    { $addFields: { customerKey: CUSTOMER_KEY_EXPR } },
    { $group: { _id: '$customerKey', ordersCountInRange: { $sum: 1 }, revenueInRangeFils: { $sum: '$grandTotalFils' } } },
  ]).exec();
  return rows.map((r) => ({ customerKey: r._id, ordersCountInRange: r.ordersCountInRange, revenueInRangeFils: r.revenueInRangeFils }));
}
