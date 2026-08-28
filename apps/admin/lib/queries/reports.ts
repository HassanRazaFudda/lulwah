import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import {
  CustomersReportResponse,
  DiscountsReportResponse,
  InventoryReportResponse,
  ProductsReportResponse,
  SalesReportGroupBy,
  SalesReportResponse,
  SearchReportResponse,
} from '@lulwah/contracts';
import { apiRequest, apiRequestCsv } from '../api-client';
import { triggerBrowserDownload } from '../download-file';
import { buildQueryString } from './query-utils';

/**
 * Reports data-fetching layer — `GET /admin/reports/*`
 * (`apps/api/src/modules/report/report.routes.ts`, plan.md §11.1). Six
 * hooks, one per category that module actually built:
 * sales/products/customers/discounts/inventory/search. **Traffic is
 * deliberately not represented here at all** — `report.routes.ts`'s own
 * doc comment confirms no GA4 (or any analytics) integration exists
 * anywhere in this repo, so there is no endpoint to call and nothing this
 * file could honestly fetch; the Reports screen shows that category as
 * "not available" rather than this file returning fabricated data.
 *
 * Query params sent below are exactly what each `*ReportQuery` schema in
 * `report.dto.ts` accepts — verified by reading that file, not assumed:
 * `dateFrom`/`dateTo` on every category except Inventory (which has no
 * date dimension — ageing/low-stock are both "right now" snapshots);
 * `groupBy` only on Sales; `limit` on Products/Customers/Search;
 * `lowStockLimit` only on Inventory. Nothing here invents a param the
 * backend doesn't read.
 */

export interface ReportDateRangeFilter {
  dateFrom?: string | undefined; // 'YYYY-MM-DD' from <input type="date">
  dateTo?: string | undefined;
}

const SalesReportEnvelope = z.object({ report: SalesReportResponse });
const ProductsReportEnvelope = z.object({ report: ProductsReportResponse });
const CustomersReportEnvelope = z.object({ report: CustomersReportResponse });
const DiscountsReportEnvelope = z.object({ report: DiscountsReportResponse });
const InventoryReportEnvelope = z.object({ report: InventoryReportResponse });
const SearchReportEnvelope = z.object({ report: SearchReportResponse });

export interface SalesReportFilter extends ReportDateRangeFilter {
  groupBy: SalesReportGroupBy;
}

export function useSalesReportQuery(filter: SalesReportFilter) {
  return useQuery({
    queryKey: ['admin', 'reports', 'sales', filter],
    queryFn: () =>
      apiRequest(
        `/admin/reports/sales${buildQueryString({ dateFrom: filter.dateFrom, dateTo: filter.dateTo, groupBy: filter.groupBy })}`,
        SalesReportEnvelope,
      ).then((r) => r.report),
    retry: false,
  });
}

export interface ReportLimitFilter extends ReportDateRangeFilter {
  limit: number;
}

export function useProductsReportQuery(filter: ReportLimitFilter) {
  return useQuery({
    queryKey: ['admin', 'reports', 'products', filter],
    queryFn: () =>
      apiRequest(
        `/admin/reports/products${buildQueryString({ dateFrom: filter.dateFrom, dateTo: filter.dateTo, limit: filter.limit })}`,
        ProductsReportEnvelope,
      ).then((r) => r.report),
    retry: false,
  });
}

export function useCustomersReportQuery(filter: ReportLimitFilter) {
  return useQuery({
    queryKey: ['admin', 'reports', 'customers', filter],
    queryFn: () =>
      apiRequest(
        `/admin/reports/customers${buildQueryString({ dateFrom: filter.dateFrom, dateTo: filter.dateTo, limit: filter.limit })}`,
        CustomersReportEnvelope,
      ).then((r) => r.report),
    retry: false,
  });
}

export function useDiscountsReportQuery(filter: ReportDateRangeFilter) {
  return useQuery({
    queryKey: ['admin', 'reports', 'discounts', filter],
    queryFn: () =>
      apiRequest(
        `/admin/reports/discounts${buildQueryString({ dateFrom: filter.dateFrom, dateTo: filter.dateTo })}`,
        DiscountsReportEnvelope,
      ).then((r) => r.report),
    retry: false,
  });
}

/** No date range — `InventoryReportQuery` (report.dto.ts) only accepts
 *  `lowStockLimit`; ageing buckets key off `Variant.createdAt`, not an
 *  order window, and stock levels are inherently "as of now." */
export function useInventoryReportQuery(lowStockLimit = 100) {
  return useQuery({
    queryKey: ['admin', 'reports', 'inventory', lowStockLimit],
    queryFn: () =>
      apiRequest(`/admin/reports/inventory${buildQueryString({ lowStockLimit })}`, InventoryReportEnvelope).then(
        (r) => r.report,
      ),
    retry: false,
  });
}

export function useSearchReportQuery(filter: ReportLimitFilter) {
  return useQuery({
    queryKey: ['admin', 'reports', 'search', filter],
    queryFn: () =>
      apiRequest(
        `/admin/reports/search${buildQueryString({ dateFrom: filter.dateFrom, dateTo: filter.dateTo, limit: filter.limit })}`,
        SearchReportEnvelope,
      ).then((r) => r.report),
    retry: false,
  });
}

/**
 * CSV export — one generic mutation for all six categories, since every
 * `report.controller.ts` handler shapes its own CSV server-side; this
 * client only needs to hit `?format=csv` and hand the browser whatever
 * comes back (see `apiRequestCsv`'s doc comment on why this can't be a
 * plain `<a href>` link). `?format=csv` requires `reports.write`
 * (`report.policy.ts`) on top of the `reports.read` the rest of this
 * screen needs — a user who can view but not export gets a real 403 here,
 * surfaced via `isForbiddenError` at the call site rather than silently
 * failing.
 */
export function useExportReportCsv() {
  return useMutation({
    mutationFn: async ({ path, fallbackFilename }: { path: string; fallbackFilename: string }) => {
      const { blob, filename } = await apiRequestCsv(path, fallbackFilename);
      triggerBrowserDownload(blob, filename);
    },
  });
}
