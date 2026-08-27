import { OrderModel } from '../order/order.model.js';
import { buildSalesMatch } from './sales.repository.js';

/**
 * Discounts report — plan.md §11.1: "usage, revenue, margin impact." Same
 * documented `report`-only exception as `sales.repository.ts` (plan.md
 * §5.3): reads `OrderModel` directly, read-only.
 *
 * Deliberately a plain `.find().lean()` here, NOT an aggregation
 * pipeline — the grouping this report needs has a real correctness trap
 * an aggregation pipeline makes easy to get subtly wrong: one order can
 * carry more than one `discounts[]` ENTRY for the same `discountId`
 * (`appliedTo: 'item'` writes one entry per item it discounted, plan.md
 * §7.11), so a naive `$unwind: '$discounts'` then `$sum: '$grandTotalFils'`
 * would double-count that order's revenue for any discount that touched
 * two of its items. Pulling the (small, admin-report-scoped) order set
 * into Node and reducing in plain TypeScript makes that dedup a single
 * explicit `Set`, not a multi-stage pipeline gamble — see
 * `report.service.ts#buildDiscountsReport` for the reduction itself.
 */
export interface DiscountOrderRaw {
  orderId: string;
  grandTotalFils: number;
  discountEntries: { discountId: string; code: string | null; type: string; amountFils: number }[];
  /** Every item in the order, not just the ones a given discount line
   *  applied to — this report attributes an order's full cost-of-goods
   *  to every discount that touched any part of it (documented
   *  approximation, see `DiscountReportRow.estimatedMarginImpactFils`'s
   *  doc comment in `@lulwah/contracts`). */
  items: { variantId: string; quantity: number }[];
}

export async function getOrdersWithDiscounts(dateFrom: Date | undefined, dateTo: Date | undefined): Promise<DiscountOrderRaw[]> {
  const docs = await OrderModel.find({ ...buildSalesMatch(dateFrom, dateTo), 'discounts.0': { $exists: true } })
    .select('discounts items.variantId items.quantity grandTotalFils')
    .lean()
    .exec();
  return docs.map((doc) => ({
    orderId: doc._id.toString(),
    grandTotalFils: doc.grandTotalFils,
    discountEntries: doc.discounts.map((entry) => ({ discountId: entry.discountId.toString(), code: entry.code, type: entry.type, amountFils: entry.amountFils })),
    items: doc.items.map((item) => ({ variantId: item.variantId.toString(), quantity: item.quantity })),
  }));
}
