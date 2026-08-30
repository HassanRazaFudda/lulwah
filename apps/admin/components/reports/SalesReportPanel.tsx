'use client';

import { useState } from 'react';
import type { SalesReportGroupBy, SalesReportRow } from '@lulwah/contracts';
import { formatMoney } from '@lulwah/utils';
import { DataTable } from '../DataTable';
import type { DataTableColumn } from '../DataTable';
import { buildQueryString } from '../../lib/queries/query-utils';
import { useSalesReportQuery } from '../../lib/queries/reports';
import { DateRangeFields, ReportToolbar, ReportToolbarFields } from './ReportToolbar';
import { ExportCsvButton } from './ExportCsvButton';
import { ReportStateGate } from './ReportStateGate';

const GROUP_BY_OPTIONS: { value: SalesReportGroupBy; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'brand', label: 'Brand' },
  { value: 'category', label: 'Category' },
  { value: 'collection', label: 'Collection' },
  { value: 'emirate', label: 'Emirate' },
  { value: 'paymentMethod', label: 'Payment method' },
];

/** These groupings can legitimately double-count against `totals` — one
 *  order can touch more than one brand/category/collection, so each row
 *  counts what it actually contributed, not a forced partition
 *  (`SalesReportResponse`'s own doc comment in `@lulwah/contracts`). Shown
 *  as a caption rather than left for someone to notice the arithmetic
 *  doesn't add up and assume a bug. */
const MULTI_COUNT_GROUPINGS: ReadonlySet<SalesReportGroupBy> = new Set(['brand', 'category', 'collection']);

const COLUMNS: DataTableColumn<SalesReportRow>[] = [
  { id: 'label', header: 'Label', cell: (r) => <span className="font-semibold text-ink">{r.label}</span> },
  { id: 'orders', header: 'Orders', align: 'right', cell: (r) => r.ordersCount },
  { id: 'units', header: 'Units sold', align: 'right', cell: (r) => r.unitsSold },
  { id: 'subtotal', header: 'Subtotal', align: 'right', cell: (r) => formatMoney(r.subtotalFils, 'en') },
  { id: 'discount', header: 'Discount', align: 'right', cell: (r) => formatMoney(r.discountFils, 'en') },
  {
    id: 'grandTotal',
    header: 'Grand total',
    align: 'right',
    cell: (r) => <span className="font-semibold">{formatMoney(r.grandTotalFils, 'en')}</span>,
  },
];

export function SalesReportPanel() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [groupBy, setGroupBy] = useState<SalesReportGroupBy>('day');

  const query = useSalesReportQuery({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, groupBy });

  const csvPath = `/admin/reports/sales${buildQueryString({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    groupBy,
    format: 'csv',
  })}`;

  return (
    <div className="flex flex-col gap-16">
      <ReportToolbar>
        <ReportToolbarFields>
          <label className="flex items-center gap-8 text-body-sm text-ink-70">
            Group by
            <select
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as SalesReportGroupBy)}
              className="h-[40px] border border-line bg-paper px-12 text-body-sm text-ink outline-none focus:border-zamurrad"
            >
              {GROUP_BY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <DateRangeFields dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
        </ReportToolbarFields>
        <ExportCsvButton path={csvPath} fallbackFilename={`sales-report-${groupBy}.csv`} />
      </ReportToolbar>

      <ReportStateGate isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {query.data ? (
          <div className="flex flex-col gap-8">
            {MULTI_COUNT_GROUPINGS.has(groupBy) ? (
              <p className="text-[11px] text-ink-70">
                One order can touch more than one {groupBy}, so rows can sum to more than the totals below.
              </p>
            ) : null}
            <DataTable
              columns={COLUMNS}
              rows={query.data.rows}
              getRowId={(r) => r.key}
              emptyMessage="No sales in this window."
            />
            <div className="flex flex-wrap gap-24 border border-line bg-paper p-16">
              <Stat label="Orders" value={String(query.data.totals.ordersCount)} />
              <Stat label="Units sold" value={String(query.data.totals.unitsSold)} />
              <Stat label="Subtotal" value={formatMoney(query.data.totals.subtotalFils, 'en')} />
              <Stat label="Discount" value={formatMoney(query.data.totals.discountFils, 'en')} />
              <Stat label="Grand total" value={formatMoney(query.data.totals.grandTotalFils, 'en')} />
            </div>
          </div>
        ) : null}
      </ReportStateGate>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-label text-ink-70">{label}</p>
      <p className="text-body-sm font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}
