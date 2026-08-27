import type {
  CohortRetentionPoint,
  CohortRow,
  CustomerSegmentSummary,
  CustomersReportResponse,
  DiscountReportRow,
  DiscountsReportResponse,
  InventoryAgeingBucket,
  InventoryReportResponse,
  LowStockRow,
  NeverSoldProductRow,
  ProductPerformanceRow,
  ProductsReportResponse,
  SalesReportGroupBy,
  SalesReportResponse,
  SalesReportRow,
  SearchReportResponse,
  TopCustomerRow,
} from '@lulwah/contracts';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as productService from '../catalog/product.service.js';
import * as brandService from '../catalog/brand.service.js';
import * as variantService from '../catalog/variant.service.js';
import * as searchService from '../catalog/search.service.js';
import * as pricingService from '../pricing/pricing.service.js';
import * as identityService from '../identity/identity.service.js';
import * as inventoryService from '../inventory/inventory.service.js';
import * as salesRepo from './sales.repository.js';
import * as productsRepo from './products.repository.js';
import * as customersRepo from './customers.repository.js';
import type { CustomerLifetimeStatsRaw } from './customers.repository.js';
import * as discountsRepo from './discounts.repository.js';
import type { SalesReportQuery, CustomersReportQuery, DiscountsReportQuery, InventoryReportQuery, ProductsReportQuery, SearchReportQuery } from './report.dto.js';

/**
 * All report business logic lives here, framework-free (no `express`) —
 * same split as every other module's `*.service.ts`. `*.repository.ts`
 * files in this module are the ones documented as crossing plan.md
 * §5.3's module boundary (read-only aggregation over `orders`); this
 * file composes their output with OTHER modules' normal exported service
 * functions (`catalog`/`pricing`/`identity`/`inventory`) exactly the way
 * any other module would.
 */

function assertRead(actor: AuthenticatedUser): void {
  // Route-level `requireReportRead()` already guards every endpoint;
  // re-checked here per plan.md §10.2's "re-checked in the service
  // layer — never in the UI alone," same as every other module.
  assertPermission(actor, 'reports.read');
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

const EMIRATE_LABELS: Record<string, string> = {
  dubai: 'Dubai',
  abu_dhabi: 'Abu Dhabi',
  sharjah: 'Sharjah',
  ajman: 'Ajman',
  ras_al_khaimah: 'Ras Al Khaimah',
  fujairah: 'Fujairah',
  umm_al_quwain: 'Umm Al Quwain',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Card',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  cod: 'Cash on Delivery',
  tabby: 'Tabby',
  tamara: 'Tamara',
  bank_transfer: 'Bank Transfer',
};

function salesRowLabel(groupBy: SalesReportGroupBy, key: string, rawLabel: string): string {
  if (groupBy === 'emirate') return EMIRATE_LABELS[key] ?? key;
  if (groupBy === 'paymentMethod') return PAYMENT_METHOD_LABELS[key] ?? key;
  return rawLabel;
}

export async function getSalesReport(actor: AuthenticatedUser, query: SalesReportQuery): Promise<SalesReportResponse> {
  assertRead(actor);
  const [rawRows, totals] = await Promise.all([
    salesRepo.getSalesRows(query.groupBy, query.dateFrom, query.dateTo),
    salesRepo.getSalesTotals(query.dateFrom, query.dateTo),
  ]);
  const rows: SalesReportRow[] = rawRows.map((r) => ({ ...r, label: salesRowLabel(query.groupBy, r.key, r.label) }));
  return { groupBy: query.groupBy, dateFrom: query.dateFrom ?? null, dateTo: query.dateTo ?? null, rows, totals };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function getProductsReport(actor: AuthenticatedUser, query: ProductsReportQuery): Promise<ProductsReportResponse> {
  assertRead(actor);
  const [bestRaw, worstRaw, neverSold] = await Promise.all([
    productsRepo.getBestSellers(query.dateFrom, query.dateTo, query.limit),
    productsRepo.getWorstSellers(query.dateFrom, query.dateTo, query.limit),
    productService.getNeverSoldProducts(query.limit),
  ]);

  const soldProductIds = Array.from(new Set([...bestRaw, ...worstRaw].map((r) => r.productId)));
  const products = await productService.getProductsByIds(soldProductIds);
  const stockByProductId = new Map(products.map((p) => [p.id, p.totalStock]));

  function toPerformanceRow(r: productsRepo.ProductPerformanceRawRow): ProductPerformanceRow {
    const currentStock = stockByProductId.get(r.productId) ?? 0;
    const denominator = r.unitsSold + currentStock;
    const sellThroughRate = denominator > 0 ? r.unitsSold / denominator : 0;
    return { productId: r.productId, title: r.title, articleCode: r.articleCode, brandName: r.brandName, unitsSold: r.unitsSold, revenueFils: r.revenueFils, currentStock, sellThroughRate };
  }

  const neverSoldBrandIds = Array.from(new Set(neverSold.products.map((p) => p.brandId)));
  const neverSoldBrands = await brandService.getBrandsByIds(neverSoldBrandIds);
  const brandNameById = new Map(neverSoldBrands.map((b) => [b.id, b.name]));
  const neverSoldRows: NeverSoldProductRow[] = neverSold.products.map((p) => ({
    productId: p.id,
    title: p.title,
    articleCode: p.articleCode,
    brandName: brandNameById.get(p.brandId) ?? '',
    currentStock: p.totalStock,
    createdAt: p.createdAt,
  }));

  return {
    dateFrom: query.dateFrom ?? null,
    dateTo: query.dateTo ?? null,
    bestSellers: bestRaw.map(toPerformanceRow),
    worstSellers: worstRaw.map(toPerformanceRow),
    neverSold: neverSoldRows,
    neverSoldCount: neverSold.total,
  };
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/** Matches `sales.repository.ts#getSalesRows`'s `day` grouping's own
 *  `timezone: 'Asia/Dubai'` `$dateToString` so a customer's JS-computed
 *  cohort month always lines up with the Mongo-computed `activeMonths`
 *  it gets tested against below (UAE has no DST, so a fixed +4h shift is
 *  exact, not an approximation). */
function toDubaiYearMonth(date: Date): string {
  const shifted = new Date(date.getTime() + 4 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 7);
}

function addMonths(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split('-').map(Number) as [number, number];
  const total = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

const COHORT_RETENTION_MONTHS = 6;
const COHORT_MAX_COUNT = 24;

function buildCohorts(lifetime: readonly CustomerLifetimeStatsRaw[], dateFrom: Date | undefined, dateTo: Date | undefined): CohortRow[] {
  const byCohortMonth = new Map<string, CustomerLifetimeStatsRaw[]>();
  for (const customer of lifetime) {
    const cohortMonth = toDubaiYearMonth(customer.firstOrderAt);
    const bucket = byCohortMonth.get(cohortMonth);
    if (bucket) bucket.push(customer);
    else byCohortMonth.set(cohortMonth, [customer]);
  }

  const fromMonth = dateFrom ? toDubaiYearMonth(dateFrom) : null;
  const toMonth = dateTo ? toDubaiYearMonth(dateTo) : null;
  const nowMonth = toDubaiYearMonth(new Date());

  const cohortMonths = Array.from(byCohortMonth.keys())
    .filter((m) => (fromMonth === null || m >= fromMonth) && (toMonth === null || m <= toMonth))
    .sort()
    .reverse()
    // No explicit range given: cap the tail so a long-running store's
    // response stays bounded rather than returning every cohort ever.
    .slice(0, fromMonth || toMonth ? COHORT_MAX_COUNT : COHORT_RETENTION_MONTHS * 2);

  return cohortMonths.map((cohortMonth) => {
    const members = byCohortMonth.get(cohortMonth) ?? [];
    const retention: CohortRetentionPoint[] = [];
    for (let offset = 0; offset < COHORT_RETENTION_MONTHS; offset += 1) {
      const targetMonth = addMonths(cohortMonth, offset);
      if (targetMonth > nowMonth) break; // that month hasn't happened yet
      const activeCustomers = members.filter((m) => m.activeMonths.includes(targetMonth)).length;
      retention.push({ monthOffset: offset, activeCustomers, retentionRate: members.length > 0 ? activeCustomers / members.length : 0 });
    }
    return { cohortMonth, cohortSize: members.length, retention };
  });
}

export async function getCustomersReport(actor: AuthenticatedUser, query: CustomersReportQuery): Promise<CustomersReportResponse> {
  assertRead(actor);
  const [lifetime, rangeStats] = await Promise.all([customersRepo.getCustomerLifetimeStats(), customersRepo.getCustomerRangeStats(query.dateFrom, query.dateTo)]);
  const lifetimeByKey = new Map(lifetime.map((c) => [c.customerKey, c]));

  // New vs returning, scoped to the requested window — see
  // `CustomersReportResponse`'s doc comment in `@lulwah/contracts`: a
  // customer is "new" iff their all-time first order falls inside
  // [dateFrom, dateTo]. If `dateFrom` is omitted, every customer in
  // range trivially qualifies as "new" (an unbounded lower edge) — pass
  // a `dateFrom` for a meaningful split; documented, not a bug.
  const newCustomers: CustomerSegmentSummary = { customers: 0, ordersCount: 0, revenueFils: 0 };
  const returningCustomers: CustomerSegmentSummary = { customers: 0, ordersCount: 0, revenueFils: 0 };
  for (const range of rangeStats) {
    const life = lifetimeByKey.get(range.customerKey);
    if (!life) continue;
    const isNew = (!query.dateFrom || life.firstOrderAt >= query.dateFrom) && (!query.dateTo || life.firstOrderAt <= query.dateTo);
    const bucket = isNew ? newCustomers : returningCustomers;
    bucket.customers += 1;
    bucket.ordersCount += range.ordersCountInRange;
    bucket.revenueFils += range.revenueInRangeFils;
  }

  const averageLtvFils = lifetime.length > 0 ? Math.round(lifetime.reduce((sum, c) => sum + c.totalSpentFils, 0) / lifetime.length) : 0;

  const topLifetime = [...lifetime].sort((a, b) => b.totalSpentFils - a.totalSpentFils).slice(0, query.limit);
  const userIds = topLifetime.filter((c) => c.userId).map((c) => c.userId as string);
  const users = await identityService.getUsersByIds(userIds);
  const userById = new Map(users.map((u) => [u.id, u]));
  const topCustomersByLtv: TopCustomerRow[] = topLifetime.map((c) => {
    const user = c.userId ? userById.get(c.userId) : undefined;
    return {
      customerKey: c.customerKey,
      name: user ? `${user.firstName} ${user.lastName}`.trim() : 'Guest',
      email: user?.email ?? c.guestEmail,
      ordersCount: c.ordersCount,
      totalSpentFils: c.totalSpentFils,
      firstOrderAt: c.firstOrderAt,
      lastOrderAt: c.lastOrderAt,
    };
  });

  const cohorts = buildCohorts(lifetime, query.dateFrom, query.dateTo);

  return { dateFrom: query.dateFrom ?? null, dateTo: query.dateTo ?? null, newCustomers, returningCustomers, averageLtvFils, topCustomersByLtv, cohorts };
}

// ---------------------------------------------------------------------------
// Discounts
// ---------------------------------------------------------------------------

export async function getDiscountsReport(actor: AuthenticatedUser, query: DiscountsReportQuery): Promise<DiscountsReportResponse> {
  assertRead(actor);
  const orders = await discountsRepo.getOrdersWithDiscounts(query.dateFrom, query.dateTo);
  if (orders.length === 0) return { dateFrom: query.dateFrom ?? null, dateTo: query.dateTo ?? null, rows: [] };

  const variantIds = Array.from(new Set(orders.flatMap((o) => o.items.map((i) => i.variantId))));
  const variants = await variantService.getVariantsWithCostByIds(variantIds);
  const costByVariantId = new Map(variants.map((v) => [v.id, v.costPriceFils ?? 0]));

  interface Accumulator {
    discountId: string;
    code: string | null;
    type: string;
    orderIds: Set<string>;
    discountGivenFils: number;
    revenueFils: number;
    cogsFils: number;
  }
  const byDiscountId = new Map<string, Accumulator>();

  for (const order of orders) {
    const orderCogsFils = order.items.reduce((sum, item) => sum + item.quantity * (costByVariantId.get(item.variantId) ?? 0), 0);
    for (const entry of order.discountEntries) {
      let acc = byDiscountId.get(entry.discountId);
      if (!acc) {
        acc = { discountId: entry.discountId, code: entry.code, type: entry.type, orderIds: new Set(), discountGivenFils: 0, revenueFils: 0, cogsFils: 0 };
        byDiscountId.set(entry.discountId, acc);
      }
      acc.discountGivenFils += entry.amountFils;
      // Only credit this order's revenue/COGS to this discount once, even
      // if the discount produced multiple `discounts[]` entries on this
      // order (one per item it applied to, plan.md §7.11) — see this
      // file's doc comment / `discounts.repository.ts`'s for why this
      // can't be a `$group` accumulator instead.
      if (!acc.orderIds.has(order.orderId)) {
        acc.orderIds.add(order.orderId);
        acc.revenueFils += order.grandTotalFils;
        acc.cogsFils += orderCogsFils;
      }
    }
  }

  const discountMeta = await pricingService.getDiscountsByIds(Array.from(byDiscountId.keys()));
  const metaById = new Map(discountMeta.map((d) => [d.id, d]));

  const rows: DiscountReportRow[] = Array.from(byDiscountId.values())
    .map((acc) => {
      const meta = metaById.get(acc.discountId);
      return {
        discountId: acc.discountId,
        name: meta?.name ?? '(deleted discount)',
        code: meta?.code ?? acc.code,
        type: meta?.type ?? acc.type,
        status: meta?.status ?? 'unknown',
        ordersCount: acc.orderIds.size,
        discountGivenFils: acc.discountGivenFils,
        revenueFils: acc.revenueFils,
        estimatedMarginImpactFils: acc.revenueFils - acc.cogsFils,
      };
    })
    .sort((a, b) => b.discountGivenFils - a.discountGivenFils);

  return { dateFrom: query.dateFrom ?? null, dateTo: query.dateTo ?? null, rows };
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

const AGE_BUCKET_KEYS = ['0_30', '31_60', '61_90', '90_plus'] as const;
type AgeBucketKey = (typeof AGE_BUCKET_KEYS)[number];

function ageBucketFor(ageDays: number): AgeBucketKey {
  if (ageDays <= 30) return '0_30';
  if (ageDays <= 60) return '31_60';
  if (ageDays <= 90) return '61_90';
  return '90_plus';
}

/** Composes three modules' own exported service functions
 *  (`inventory.adminListInventory`, `catalog.getVariantsWithCostByIds`,
 *  `catalog.getProductsByIds`) — no cross-module aggregation crossing at
 *  all in this report, unlike sales/products/customers/discounts above. */
export async function getInventoryReport(actor: AuthenticatedUser, query: InventoryReportQuery): Promise<InventoryReportResponse> {
  assertRead(actor);
  const BIG_PAGE = 100_000; // effectively "all" — this catalog's whole inventory list, not a paginated slice
  const [allItemsPage, lowStockPage] = await Promise.all([
    inventoryService.adminListInventory(actor, {}, 1, BIG_PAGE),
    inventoryService.adminListInventory(actor, { lowStock: true }, 1, query.lowStockLimit),
  ]);
  const items = allItemsPage.items;

  const variantIds = Array.from(new Set(items.map((i) => i.variantId)));
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const [variants, products] = await Promise.all([variantService.getVariantsWithCostByIds(variantIds), productService.getProductsByIds(productIds)]);
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const productById = new Map(products.map((p) => [p.id, p]));

  let totalUnitsOnHand = 0;
  let totalValueAtCostFils = 0;
  let totalValueAtRetailFils = 0;
  const buckets: Record<AgeBucketKey, { variantCount: number; unitsOnHand: number; valueAtCostFils: number }> = {
    '0_30': { variantCount: 0, unitsOnHand: 0, valueAtCostFils: 0 },
    '31_60': { variantCount: 0, unitsOnHand: 0, valueAtCostFils: 0 },
    '61_90': { variantCount: 0, unitsOnHand: 0, valueAtCostFils: 0 },
    '90_plus': { variantCount: 0, unitsOnHand: 0, valueAtCostFils: 0 },
  };
  const now = Date.now();

  for (const item of items) {
    const variant = variantById.get(item.variantId);
    const product = productById.get(item.productId);
    const costFils = variant?.costPriceFils ?? 0;
    const retailFils = product?.effectivePriceFils ?? 0;

    totalUnitsOnHand += item.onHand;
    totalValueAtCostFils += item.onHand * costFils;
    totalValueAtRetailFils += item.onHand * retailFils;

    // Ageing is approximated as days since the variant was created — see
    // `InventoryReportResponse`'s doc comment in `@lulwah/contracts` for
    // why this isn't a `stock_movements`-derived "days since last
    // restock" (a documented simplification, not an oversight).
    const ageDays = variant ? Math.floor((now - variant.createdAt.getTime()) / 86_400_000) : 0;
    const bucket = buckets[ageBucketFor(ageDays)];
    bucket.variantCount += 1;
    bucket.unitsOnHand += item.onHand;
    bucket.valueAtCostFils += item.onHand * costFils;
  }

  const ageing: InventoryAgeingBucket[] = AGE_BUCKET_KEYS.map((bucket) => ({ bucket, ...buckets[bucket] }));

  const lowStock: LowStockRow[] = lowStockPage.items.map((item) => ({
    variantId: item.variantId,
    productId: item.productId,
    sku: item.sku,
    title: productById.get(item.productId)?.title ?? item.sku,
    onHand: item.onHand,
    available: item.available,
    lowStockThreshold: item.lowStockThreshold,
  }));

  return { totalUnitsOnHand, totalValueAtCostFils, totalValueAtRetailFils, ageing, lowStock, lowStockCount: lowStockPage.total };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** Entirely via `catalog`'s own exported seam (`search.service.ts`) — no
 *  module-boundary crossing in `report` at all for this report; see that
 *  file's doc comment for where the underlying `search_queries` log
 *  itself gets written. */
export async function getSearchReport(actor: AuthenticatedUser, query: SearchReportQuery): Promise<SearchReportResponse> {
  assertRead(actor);
  const [topQueries, zeroResultQueries] = await Promise.all([
    searchService.getTopSearchQueries(query.dateFrom, query.dateTo, query.limit),
    searchService.getZeroResultSearchQueries(query.dateFrom, query.dateTo, query.limit),
  ]);
  return { dateFrom: query.dateFrom ?? null, dateTo: query.dateTo ?? null, topQueries, zeroResultQueries };
}
