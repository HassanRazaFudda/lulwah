import { z } from 'zod';
import {
  CustomersReportResponse,
  DiscountsReportResponse,
  InventoryReportResponse,
  ProductsReportResponse,
  ReportExportFormat,
  SalesReportGroupBy,
  SalesReportResponse,
  SearchReportResponse,
} from '@lulwah/contracts';

/**
 * Request/response DTOs for `report` — plan.md §11.1. Response shapes
 * (`SalesReportResponse`, ...) live in `@lulwah/contracts`, reused as-is;
 * everything below is query-param parsing, module-local to this HTTP
 * surface (no other consumer needs it on the wire).
 */

export { SalesReportResponse, ProductsReportResponse, CustomersReportResponse, DiscountsReportResponse, InventoryReportResponse, SearchReportResponse };

const dateRangeShape = {
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
};

const formatShape = { format: ReportExportFormat.default('json') };

export const SalesReportQuery = z.object({
  ...dateRangeShape,
  ...formatShape,
  groupBy: SalesReportGroupBy.default('day'),
});
export type SalesReportQuery = z.infer<typeof SalesReportQuery>;

export const ProductsReportQuery = z.object({
  ...dateRangeShape,
  ...formatShape,
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ProductsReportQuery = z.infer<typeof ProductsReportQuery>;

export const CustomersReportQuery = z.object({
  ...dateRangeShape,
  ...formatShape,
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type CustomersReportQuery = z.infer<typeof CustomersReportQuery>;

export const DiscountsReportQuery = z.object({
  ...dateRangeShape,
  ...formatShape,
});
export type DiscountsReportQuery = z.infer<typeof DiscountsReportQuery>;

export const InventoryReportQuery = z.object({
  ...formatShape,
  lowStockLimit: z.coerce.number().int().positive().max(500).default(100),
});
export type InventoryReportQuery = z.infer<typeof InventoryReportQuery>;

export const SearchReportQuery = z.object({
  ...dateRangeShape,
  ...formatShape,
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type SearchReportQuery = z.infer<typeof SearchReportQuery>;
