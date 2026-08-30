'use client';

import { useState } from 'react';
import type { NeverSoldProductRow, ProductPerformanceRow } from '@lulwah/contracts';
import { formatDate, formatMoney } from '@lulwah/utils';
import { DataTable } from '../DataTable';
import type { DataTableColumn } from '../DataTable';
import { buildQueryString } from '../../lib/queries/query-utils';
import { useProductsReportQuery } from '../../lib/queries/reports';
import { DateRangeFields, LimitSelect, ReportToolbar, ReportToolbarFields } from './ReportToolbar';
import { ExportCsvButton } from './ExportCsvButton';
import { ReportStateGate } from './ReportStateGate';

const PERFORMANCE_COLUMNS: DataTableColumn<ProductPerformanceRow>[] = [
  { id: 'title', header: 'Title', cell: (r) => <span className="font-semibold text-ink">{r.title}</span> },
  { id: 'articleCode', header: 'Article code', cell: (r) => r.articleCode },
  { id: 'brand', header: 'Brand', cell: (r) => r.brandName },
  { id: 'unitsSold', header: 'Units sold', align: 'right', cell: (r) => r.unitsSold },
  { id: 'revenue', header: 'Revenue', align: 'right', cell: (r) => formatMoney(r.revenueFils, 'en') },
  { id: 'stock', header: 'Current stock', align: 'right', cell: (r) => r.currentStock },
  {
    id: 'sellThrough',
    header: 'Sell-through',
    align: 'right',
    cell: (r) => `${(r.sellThroughRate * 100).toFixed(1)}%`,
  },
];

const NEVER_SOLD_COLUMNS: DataTableColumn<NeverSoldProductRow>[] = [
  { id: 'title', header: 'Title', cell: (r) => <span className="font-semibold text-ink">{r.title}</span> },
  { id: 'articleCode', header: 'Article code', cell: (r) => r.articleCode },
  { id: 'brand', header: 'Brand', cell: (r) => r.brandName },
  { id: 'stock', header: 'Current stock', align: 'right', cell: (r) => r.currentStock },
  { id: 'createdAt', header: 'Listed', cell: (r) => formatDate(r.createdAt, 'en') },
];

export function ProductsReportPanel() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [limit, setLimit] = useState(20);

  const query = useProductsReportQuery({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit });

  const csvPath = `/admin/reports/products${buildQueryString({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit,
    format: 'csv',
  })}`;

  return (
    <div className="flex flex-col gap-16">
      <ReportToolbar>
        <ReportToolbarFields>
          <DateRangeFields dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
          <LimitSelect label="Rows per list" value={limit} onChange={setLimit} />
        </ReportToolbarFields>
        <ExportCsvButton path={csvPath} fallbackFilename="products-report.csv" />
      </ReportToolbar>

      <ReportStateGate isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {query.data ? (
          <div className="flex flex-col gap-24">
            <section className="flex flex-col gap-8">
              <h3 className="text-label font-semibold uppercase tracking-label text-ink-70">Best sellers</h3>
              <DataTable
                columns={PERFORMANCE_COLUMNS}
                rows={query.data.bestSellers}
                getRowId={(r) => r.productId}
                emptyMessage="No sales in this window."
              />
            </section>
            <section className="flex flex-col gap-8">
              <h3 className="text-label font-semibold uppercase tracking-label text-ink-70">Worst sellers</h3>
              <DataTable
                columns={PERFORMANCE_COLUMNS}
                rows={query.data.worstSellers}
                getRowId={(r) => r.productId}
                emptyMessage="No sales in this window."
              />
            </section>
            <section className="flex flex-col gap-8">
              <h3 className="text-label font-semibold uppercase tracking-label text-ink-70">
                Never sold
                {query.data.neverSoldCount > query.data.neverSold.length
                  ? ` (showing ${query.data.neverSold.length} of ${query.data.neverSoldCount})`
                  : ` (${query.data.neverSoldCount})`}
              </h3>
              <DataTable
                columns={NEVER_SOLD_COLUMNS}
                rows={query.data.neverSold}
                getRowId={(r) => r.productId}
                emptyMessage="Every product has sold at least once."
              />
            </section>
          </div>
        ) : null}
      </ReportStateGate>
    </div>
  );
}
