import { z } from 'zod';
import { objectId } from './common.js';
import { Fils, SignedFils } from './money.js';

/**
 * Reports — plan.md §11.1's admin Reports screen. This module's endpoints
 * are read-only cross-cutting aggregations over data owned by `order`,
 * `catalog`, `inventory`, `pricing`, and `identity` — see `apps/api/src/
 * modules/report/*.repository.ts` for exactly which module-boundary
 * crossings each report needs and why (plan.md §5.3's exception this
 * module was explicitly granted).
 *
 * Two categories from plan.md §11.1's row are deliberately NOT modeled
 * here:
 *  - **Traffic** (GA4 API) — no analytics integration exists anywhere in
 *    this repo (plan.md §23 was never built). Not attempted.
 *  - **Search** IS modeled below — a minimal query-logging hook was added
 *    to `catalog/search.service.ts` specifically to make this report real
 *    rather than fabricated (see that file's doc comment).
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** Every report accepts an optional inclusive date window over the
 *  relevant "when did this happen" field (`Order.placedAt` for
 *  sales/products/customers/discounts). Omitted = all-time. */
export const ReportDateRangeQuery = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ReportDateRangeQuery = z.infer<typeof ReportDateRangeQuery>;

export const ReportExportFormat = z.enum(['json', 'csv']);
export type ReportExportFormat = z.infer<typeof ReportExportFormat>;

// ---------------------------------------------------------------------------
// Sales — plan.md §11.1: "by day/brand/category/collection/emirate/payment
// method"
// ---------------------------------------------------------------------------

export const SalesReportGroupBy = z.enum(['day', 'brand', 'category', 'collection', 'emirate', 'paymentMethod']);
export type SalesReportGroupBy = z.infer<typeof SalesReportGroupBy>;

export const SalesReportRow = z.object({
  key: z.string(),
  label: z.string(),
  ordersCount: z.number().int().nonnegative(),
  unitsSold: z.number().int().nonnegative(),
  subtotalFils: Fils,
  discountFils: Fils,
  grandTotalFils: Fils,
});
export type SalesReportRow = z.infer<typeof SalesReportRow>;

export const SalesReportTotals = z.object({
  ordersCount: z.number().int().nonnegative(),
  unitsSold: z.number().int().nonnegative(),
  subtotalFils: Fils,
  discountFils: Fils,
  grandTotalFils: Fils,
});
export type SalesReportTotals = z.infer<typeof SalesReportTotals>;

/** `totals` is the true period total (one order counted once); `rows` can
 *  legitimately sum to more than `totals` for `brand`/`category`/
 *  `collection` groupings, since one order can touch more than one brand
 *  and one product can belong to more than one collection — each row
 *  counts the order/units/revenue it actually contributed, not a forced
 *  partition. */
export const SalesReportResponse = z.object({
  groupBy: SalesReportGroupBy,
  dateFrom: z.coerce.date().nullable(),
  dateTo: z.coerce.date().nullable(),
  rows: z.array(SalesReportRow),
  totals: SalesReportTotals,
});
export type SalesReportResponse = z.infer<typeof SalesReportResponse>;

// ---------------------------------------------------------------------------
// Products — plan.md §11.1: "best/worst sellers, sell-through rate,
// never-sold"
// ---------------------------------------------------------------------------

export const ProductPerformanceRow = z.object({
  productId: objectId,
  title: z.string(),
  articleCode: z.string(),
  brandName: z.string(),
  unitsSold: z.number().int().nonnegative(),
  revenueFils: Fils,
  currentStock: z.number().int(),
  /** `unitsSold / (unitsSold + currentStock)` — the standard sell-through
   *  definition, 0..1. Approximate: `currentStock` is the stock level NOW,
   *  not at the end of the report window. */
  sellThroughRate: z.number().min(0).max(1),
});
export type ProductPerformanceRow = z.infer<typeof ProductPerformanceRow>;

export const NeverSoldProductRow = z.object({
  productId: objectId,
  title: z.string(),
  articleCode: z.string(),
  brandName: z.string(),
  currentStock: z.number().int(),
  createdAt: z.coerce.date(),
});
export type NeverSoldProductRow = z.infer<typeof NeverSoldProductRow>;

export const ProductsReportResponse = z.object({
  dateFrom: z.coerce.date().nullable(),
  dateTo: z.coerce.date().nullable(),
  bestSellers: z.array(ProductPerformanceRow),
  worstSellers: z.array(ProductPerformanceRow),
  neverSold: z.array(NeverSoldProductRow),
  neverSoldCount: z.number().int().nonnegative(),
});
export type ProductsReportResponse = z.infer<typeof ProductsReportResponse>;

// ---------------------------------------------------------------------------
// Customers — plan.md §11.1: "new vs returning, cohort retention, LTV"
// ---------------------------------------------------------------------------

export const CustomerSegmentSummary = z.object({
  customers: z.number().int().nonnegative(),
  ordersCount: z.number().int().nonnegative(),
  revenueFils: Fils,
});
export type CustomerSegmentSummary = z.infer<typeof CustomerSegmentSummary>;

export const CohortRetentionPoint = z.object({
  monthOffset: z.number().int().nonnegative(),
  activeCustomers: z.number().int().nonnegative(),
  retentionRate: z.number().min(0).max(1),
});
export type CohortRetentionPoint = z.infer<typeof CohortRetentionPoint>;

export const CohortRow = z.object({
  /** `YYYY-MM` — the calendar month of each member's first-ever order. */
  cohortMonth: z.string(),
  cohortSize: z.number().int().nonnegative(),
  retention: z.array(CohortRetentionPoint),
});
export type CohortRow = z.infer<typeof CohortRow>;

export const TopCustomerRow = z.object({
  /** A registered user's id, or `guest:<email>` for a guest checkout —
   *  guests have no `User` row to key on. */
  customerKey: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  ordersCount: z.number().int().nonnegative(),
  totalSpentFils: Fils,
  firstOrderAt: z.coerce.date(),
  lastOrderAt: z.coerce.date(),
});
export type TopCustomerRow = z.infer<typeof TopCustomerRow>;

/** `newCustomers`/`returningCustomers` are scoped to orders placed inside
 *  the requested date window; `averageLtvFils`/`topCustomersByLtv`/
 *  `cohorts` are necessarily all-time (lifetime value can't be windowed)
 *  — `cohorts` only lists cohorts whose first-order month falls in the
 *  window (all-time if no window given), but each cohort's own retention
 *  trail always looks at that cohort's full order history. */
export const CustomersReportResponse = z.object({
  dateFrom: z.coerce.date().nullable(),
  dateTo: z.coerce.date().nullable(),
  newCustomers: CustomerSegmentSummary,
  returningCustomers: CustomerSegmentSummary,
  averageLtvFils: Fils,
  topCustomersByLtv: z.array(TopCustomerRow),
  cohorts: z.array(CohortRow),
});
export type CustomersReportResponse = z.infer<typeof CustomersReportResponse>;

// ---------------------------------------------------------------------------
// Discounts — plan.md §11.1: "usage, revenue, margin impact"
// ---------------------------------------------------------------------------

export const DiscountReportRow = z.object({
  discountId: objectId,
  name: z.string(),
  code: z.string().nullable(),
  type: z.string(),
  status: z.string(),
  ordersCount: z.number().int().nonnegative(),
  discountGivenFils: Fils,
  revenueFils: Fils,
  /** `revenueFils - costOfGoodsFils` for the orders this discount
   *  touched — a realized-gross-margin estimate, NOT a delta against a
   *  no-discount counterfactual. Signed because a badly-targeted
   *  discount can genuinely run at a loss. See
   *  `report/discounts.repository.ts`'s doc comment for the exact
   *  method and its documented approximations (missing `costPriceFils`
   *  on some variants; orders counted once per discount that touched
   *  them, so this can double-count on stacked discounts). */
  estimatedMarginImpactFils: SignedFils,
});
export type DiscountReportRow = z.infer<typeof DiscountReportRow>;

export const DiscountsReportResponse = z.object({
  dateFrom: z.coerce.date().nullable(),
  dateTo: z.coerce.date().nullable(),
  rows: z.array(DiscountReportRow),
});
export type DiscountsReportResponse = z.infer<typeof DiscountsReportResponse>;

// ---------------------------------------------------------------------------
// Inventory — plan.md §11.1: "stock value, ageing, low stock"
// ---------------------------------------------------------------------------

export const InventoryAgeingBucket = z.object({
  bucket: z.enum(['0_30', '31_60', '61_90', '90_plus']),
  variantCount: z.number().int().nonnegative(),
  unitsOnHand: z.number().int().nonnegative(),
  valueAtCostFils: Fils,
});
export type InventoryAgeingBucket = z.infer<typeof InventoryAgeingBucket>;

export const LowStockRow = z.object({
  variantId: objectId,
  productId: objectId,
  sku: z.string(),
  title: z.string(),
  onHand: z.number().int(),
  available: z.number().int(),
  lowStockThreshold: z.number().int(),
});
export type LowStockRow = z.infer<typeof LowStockRow>;

/** `ageing` buckets a variant by days since its `Variant.createdAt` — a
 *  documented simplification for "days since first listed," not "days
 *  since last restocked" (which would need a new inventory-module export
 *  reading `stock_movements`' `purchase`/`adjustment` history; out of
 *  scope for this pass — see `report/inventory.repository.ts`). */
export const InventoryReportResponse = z.object({
  totalUnitsOnHand: z.number().int().nonnegative(),
  totalValueAtCostFils: Fils,
  totalValueAtRetailFils: Fils,
  ageing: z.array(InventoryAgeingBucket),
  lowStock: z.array(LowStockRow),
  lowStockCount: z.number().int().nonnegative(),
});
export type InventoryReportResponse = z.infer<typeof InventoryReportResponse>;

// ---------------------------------------------------------------------------
// Search — plan.md §11.1: "top queries, zero-result queries"
// ---------------------------------------------------------------------------

export const SearchQueryRow = z.object({
  query: z.string(),
  searchCount: z.number().int().nonnegative(),
  avgResultCount: z.number().min(0),
  lastSearchedAt: z.coerce.date(),
});
export type SearchQueryRow = z.infer<typeof SearchQueryRow>;

export const SearchReportResponse = z.object({
  dateFrom: z.coerce.date().nullable(),
  dateTo: z.coerce.date().nullable(),
  topQueries: z.array(SearchQueryRow),
  zeroResultQueries: z.array(SearchQueryRow),
});
export type SearchReportResponse = z.infer<typeof SearchReportResponse>;
