import type { Request, Response } from 'express';
import { sendSuccess } from '../../shared/response.js';
import { assertReportExportPermission, requireAuthedUser } from './report.policy.js';
import * as service from './report.service.js';
import {
  CustomersReportQuery,
  DiscountsReportQuery,
  InventoryReportQuery,
  ProductsReportQuery,
  SalesReportQuery,
  SearchReportQuery,
} from './report.dto.js';
import { toCsv } from './csv.js';
import type { CsvColumn } from './csv.js';

/** Parse+validate (Zod) → call service → shape response — same split as
 *  every other module's `*.controller.ts`. The one extra thing every
 *  handler here does: when `?format=csv` is requested, it re-checks
 *  `reports.write` (route middleware only guarantees `reports.read`; see
 *  `report.policy.ts`'s doc comment) and streams a CSV instead of the
 *  §9.1 JSON envelope. */

function sendCsv(res: Response, filename: string, csv: string): void {
  res.status(200).type('text/csv; charset=utf-8').setHeader('Content-Disposition', `attachment; filename="${filename}"`).send(csv);
}

export async function sales(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = SalesReportQuery.parse(req.query);
  const report = await service.getSalesReport(actor, query);

  if (query.format === 'csv') {
    assertReportExportPermission(actor);
    const columns: CsvColumn<(typeof report.rows)[number]>[] = [
      { header: 'Key', value: (r) => r.key },
      { header: 'Label', value: (r) => r.label },
      { header: 'Orders', value: (r) => r.ordersCount },
      { header: 'Units sold', value: (r) => r.unitsSold },
      { header: 'Subtotal (fils)', value: (r) => r.subtotalFils },
      { header: 'Discount (fils)', value: (r) => r.discountFils },
      { header: 'Grand total (fils)', value: (r) => r.grandTotalFils },
    ];
    sendCsv(res, `sales-report-${query.groupBy}.csv`, toCsv(report.rows, columns));
    return;
  }
  sendSuccess(res, { report });
}

export async function products(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = ProductsReportQuery.parse(req.query);
  const report = await service.getProductsReport(actor, query);

  if (query.format === 'csv') {
    assertReportExportPermission(actor);
    // Three lists (best/worst/never-sold) in one flat CSV, distinguished
    // by a `Segment` column — a spreadsheet-friendly single download
    // rather than three separate files.
    type Row = { segment: string; productId: string; title: string; articleCode: string; brandName: string; unitsSold: number | null; revenueFils: number | null; currentStock: number };
    const rows: Row[] = [
      ...report.bestSellers.map((r): Row => ({ segment: 'best_seller', productId: r.productId, title: r.title, articleCode: r.articleCode, brandName: r.brandName, unitsSold: r.unitsSold, revenueFils: r.revenueFils, currentStock: r.currentStock })),
      ...report.worstSellers.map((r): Row => ({ segment: 'worst_seller', productId: r.productId, title: r.title, articleCode: r.articleCode, brandName: r.brandName, unitsSold: r.unitsSold, revenueFils: r.revenueFils, currentStock: r.currentStock })),
      ...report.neverSold.map((r): Row => ({ segment: 'never_sold', productId: r.productId, title: r.title, articleCode: r.articleCode, brandName: r.brandName, unitsSold: null, revenueFils: null, currentStock: r.currentStock })),
    ];
    const columns: CsvColumn<Row>[] = [
      { header: 'Segment', value: (r) => r.segment },
      { header: 'Product ID', value: (r) => r.productId },
      { header: 'Title', value: (r) => r.title },
      { header: 'Article code', value: (r) => r.articleCode },
      { header: 'Brand', value: (r) => r.brandName },
      { header: 'Units sold', value: (r) => r.unitsSold },
      { header: 'Revenue (fils)', value: (r) => r.revenueFils },
      { header: 'Current stock', value: (r) => r.currentStock },
    ];
    sendCsv(res, 'products-report.csv', toCsv(rows, columns));
    return;
  }
  sendSuccess(res, { report });
}

export async function customers(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = CustomersReportQuery.parse(req.query);
  const report = await service.getCustomersReport(actor, query);

  if (query.format === 'csv') {
    assertReportExportPermission(actor);
    // The exportable "list" part of this report is the top-customers-by-
    // LTV table — the new-vs-returning summary and cohort matrix are
    // dashboard numbers, not naturally flat rows (documented choice).
    const columns: CsvColumn<(typeof report.topCustomersByLtv)[number]>[] = [
      { header: 'Customer', value: (r) => r.customerKey },
      { header: 'Name', value: (r) => r.name },
      { header: 'Email', value: (r) => r.email },
      { header: 'Orders', value: (r) => r.ordersCount },
      { header: 'Total spent (fils)', value: (r) => r.totalSpentFils },
      { header: 'First order', value: (r) => r.firstOrderAt },
      { header: 'Last order', value: (r) => r.lastOrderAt },
    ];
    sendCsv(res, 'customers-report-top-ltv.csv', toCsv(report.topCustomersByLtv, columns));
    return;
  }
  sendSuccess(res, { report });
}

export async function discounts(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = DiscountsReportQuery.parse(req.query);
  const report = await service.getDiscountsReport(actor, query);

  if (query.format === 'csv') {
    assertReportExportPermission(actor);
    const columns: CsvColumn<(typeof report.rows)[number]>[] = [
      { header: 'Discount ID', value: (r) => r.discountId },
      { header: 'Name', value: (r) => r.name },
      { header: 'Code', value: (r) => r.code },
      { header: 'Type', value: (r) => r.type },
      { header: 'Status', value: (r) => r.status },
      { header: 'Orders', value: (r) => r.ordersCount },
      { header: 'Discount given (fils)', value: (r) => r.discountGivenFils },
      { header: 'Revenue (fils)', value: (r) => r.revenueFils },
      { header: 'Est. margin impact (fils)', value: (r) => r.estimatedMarginImpactFils },
    ];
    sendCsv(res, 'discounts-report.csv', toCsv(report.rows, columns));
    return;
  }
  sendSuccess(res, { report });
}

export async function inventory(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = InventoryReportQuery.parse(req.query);
  const report = await service.getInventoryReport(actor, query);

  if (query.format === 'csv') {
    assertReportExportPermission(actor);
    // The low-stock list is the actionable export; totals/ageing buckets
    // are dashboard-summary numbers (documented choice, same as Customers).
    const columns: CsvColumn<(typeof report.lowStock)[number]>[] = [
      { header: 'Variant ID', value: (r) => r.variantId },
      { header: 'Product ID', value: (r) => r.productId },
      { header: 'SKU', value: (r) => r.sku },
      { header: 'Title', value: (r) => r.title },
      { header: 'On hand', value: (r) => r.onHand },
      { header: 'Available', value: (r) => r.available },
      { header: 'Low stock threshold', value: (r) => r.lowStockThreshold },
    ];
    sendCsv(res, 'inventory-report-low-stock.csv', toCsv(report.lowStock, columns));
    return;
  }
  sendSuccess(res, { report });
}

export async function search(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = SearchReportQuery.parse(req.query);
  const report = await service.getSearchReport(actor, query);

  if (query.format === 'csv') {
    assertReportExportPermission(actor);
    type Row = { segment: string; query: string; searchCount: number; avgResultCount: number; lastSearchedAt: Date };
    const rows: Row[] = [
      ...report.topQueries.map((r): Row => ({ segment: 'top', ...r })),
      ...report.zeroResultQueries.map((r): Row => ({ segment: 'zero_result', ...r })),
    ];
    const columns: CsvColumn<Row>[] = [
      { header: 'Segment', value: (r) => r.segment },
      { header: 'Query', value: (r) => r.query },
      { header: 'Search count', value: (r) => r.searchCount },
      { header: 'Avg result count', value: (r) => r.avgResultCount },
      { header: 'Last searched', value: (r) => r.lastSearchedAt },
    ];
    sendCsv(res, 'search-report.csv', toCsv(rows, columns));
    return;
  }
  sendSuccess(res, { report });
}
