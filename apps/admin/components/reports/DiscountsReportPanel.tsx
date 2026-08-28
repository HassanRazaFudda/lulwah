'use client';

import { useState } from 'react';
import type { DiscountReportRow } from '@lulwah/contracts';
import { formatMoney } from '@lulwah/utils';
import { cx } from '@lulwah/ui';
import { DataTable } from '../DataTable';
import type { DataTableColumn } from '../DataTable';
import { buildQueryString } from '../../lib/queries/query-utils';
import { useDiscountsReportQuery } from '../../lib/queries/reports';
import { DateRangeFields, ReportToolbar, ReportToolbarFields } from './ReportToolbar';
import { ExportCsvButton } from './ExportCsvButton';
import { ReportStateGate } from './ReportStateGate';

const COLUMNS: DataTableColumn<DiscountReportRow>[] = [
  { id: 'name', header: 'Name', cell: (r) => <span className="font-semibold text-ink">{r.name}</span> },
  { id: 'code', header: 'Code', cell: (r) => r.code ?? '—' },
  { id: 'type', header: 'Type', cell: (r) => r.type.replace(/_/g, ' ') },
  { id: 'status', header: 'Status', cell: (r) => r.status.replace(/_/g, ' ') },
  { id: 'orders', header: 'Orders', align: 'right', cell: (r) => r.ordersCount },
  { id: 'given', header: 'Discount given', align: 'right', cell: (r) => formatMoney(r.discountGivenFils, 'en') },
  { id: 'revenue', header: 'Revenue', align: 'right', cell: (r) => formatMoney(r.revenueFils, 'en') },
  {
    id: 'margin',
    header: 'Est. margin impact',
    align: 'right',
    cell: (r) => (
      <span className={cx('font-semibold', r.estimatedMarginImpactFils < 0 && 'text-danger')}>
        {formatMoney(r.estimatedMarginImpactFils, 'en')}
      </span>
    ),
  },
];

export function DiscountsReportPanel() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const query = useDiscountsReportQuery({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });

  const csvPath = `/admin/reports/discounts${buildQueryString({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    format: 'csv',
  })}`;

  return (
    <div className="flex flex-col gap-16">
      <ReportToolbar>
        <ReportToolbarFields>
          <DateRangeFields dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
        </ReportToolbarFields>
        <ExportCsvButton path={csvPath} fallbackFilename="discounts-report.csv" />
      </ReportToolbar>

      <ReportStateGate isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {query.data ? (
          <div className="flex flex-col gap-8">
            <p className="text-[11px] text-ink-70">
              "Est. margin impact" is realized revenue minus cost of goods for orders this discount touched — an
              approximation, not a delta against a no-discount counterfactual. A negative value means this discount
              ran at a loss.
            </p>
            <DataTable
              columns={COLUMNS}
              rows={query.data.rows}
              getRowId={(r) => r.discountId}
              emptyMessage="No discounts used in this window."
            />
          </div>
        ) : null}
      </ReportStateGate>
    </div>
  );
}
