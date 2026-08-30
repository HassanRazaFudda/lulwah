'use client';

import { useMemo, useState } from 'react';
import type { CohortRow, TopCustomerRow } from '@lulwah/contracts';
import { formatDate, formatMoney } from '@lulwah/utils';
import { DataTable } from '../DataTable';
import type { DataTableColumn } from '../DataTable';
import { buildQueryString } from '../../lib/queries/query-utils';
import { useCustomersReportQuery } from '../../lib/queries/reports';
import { DateRangeFields, LimitSelect, ReportToolbar, ReportToolbarFields } from './ReportToolbar';
import { ExportCsvButton } from './ExportCsvButton';
import { ReportStateGate } from './ReportStateGate';

const TOP_CUSTOMER_COLUMNS: DataTableColumn<TopCustomerRow>[] = [
  { id: 'name', header: 'Customer', cell: (r) => <span className="font-semibold text-ink">{r.name}</span> },
  { id: 'email', header: 'Email', cell: (r) => r.email ?? '—' },
  { id: 'orders', header: 'Orders', align: 'right', cell: (r) => r.ordersCount },
  { id: 'spent', header: 'Total spent', align: 'right', cell: (r) => formatMoney(r.totalSpentFils, 'en') },
  { id: 'firstOrder', header: 'First order', cell: (r) => formatDate(r.firstOrderAt, 'en') },
  { id: 'lastOrder', header: 'Last order', cell: (r) => formatDate(r.lastOrderAt, 'en') },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-label text-ink-70">{label}</p>
      <p className="text-body-sm font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

/** `CohortRow.retention` is variable-length (only months that have
 *  actually happened yet get a point — `report.service.ts#buildCohorts`
 *  `break`s once a target month is in the future), so the matrix's column
 *  set is derived from whatever offsets are actually present rather than
 *  a hardcoded 0..5. */
function CohortMatrix({ cohorts }: { cohorts: CohortRow[] }) {
  const offsets = useMemo(() => {
    const set = new Set<number>();
    for (const cohort of cohorts) for (const point of cohort.retention) set.add(point.monthOffset);
    return Array.from(set).sort((a, b) => a - b);
  }, [cohorts]);

  if (cohorts.length === 0) {
    return <p className="text-body-sm text-ink-70">No cohorts in this window.</p>;
  }

  return (
    <div className="overflow-auto border border-line">
      <table className="w-full border-collapse text-body-sm">
        <thead className="sticky top-0 z-10 bg-nacre">
          <tr>
            <th className="whitespace-nowrap border-b border-line px-16 py-8 text-left text-label font-semibold uppercase tracking-label text-ink-70">
              Cohort
            </th>
            <th className="whitespace-nowrap border-b border-line px-16 py-8 text-right text-label font-semibold uppercase tracking-label text-ink-70">
              Size
            </th>
            {offsets.map((offset) => (
              <th
                key={offset}
                className="whitespace-nowrap border-b border-line px-16 py-8 text-right text-label font-semibold uppercase tracking-label text-ink-70"
              >
                M+{offset}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => {
            const byOffset = new Map(cohort.retention.map((p) => [p.monthOffset, p]));
            return (
              <tr key={cohort.cohortMonth} className="border-b border-line">
                <td className="px-16 py-8 font-semibold text-ink">{cohort.cohortMonth}</td>
                <td className="px-16 py-8 text-right tabular-nums">{cohort.cohortSize}</td>
                {offsets.map((offset) => {
                  const point = byOffset.get(offset);
                  return (
                    <td key={offset} className="px-16 py-8 text-right tabular-nums">
                      {point ? `${(point.retentionRate * 100).toFixed(0)}%` : '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CustomersReportPanel() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [limit, setLimit] = useState(20);

  const query = useCustomersReportQuery({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit });

  const csvPath = `/admin/reports/customers${buildQueryString({
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
          <LimitSelect label="Top customers" value={limit} onChange={setLimit} />
        </ReportToolbarFields>
        <ExportCsvButton path={csvPath} fallbackFilename="customers-report-top-ltv.csv" />
      </ReportToolbar>

      <ReportStateGate isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {query.data ? (
          <div className="flex flex-col gap-24">
            {!dateFrom ? (
              <p className="text-[11px] text-ink-70">
                No start date set, so every customer in range counts as "new" (there's no earlier boundary to compare
                against). Set "From" for a meaningful new-vs-returning split.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-24 border border-line bg-paper p-16">
              <Stat label="New customers" value={String(query.data.newCustomers.customers)} />
              <Stat label="New customer revenue" value={formatMoney(query.data.newCustomers.revenueFils, 'en')} />
              <Stat label="Returning customers" value={String(query.data.returningCustomers.customers)} />
              <Stat label="Returning customer revenue" value={formatMoney(query.data.returningCustomers.revenueFils, 'en')} />
              <Stat label="Average LTV (all-time)" value={formatMoney(query.data.averageLtvFils, 'en')} />
            </div>

            <section className="flex flex-col gap-8">
              <h3 className="text-label font-semibold uppercase tracking-label text-ink-70">Top customers by LTV</h3>
              <DataTable
                columns={TOP_CUSTOMER_COLUMNS}
                rows={query.data.topCustomersByLtv}
                getRowId={(r) => r.customerKey}
                emptyMessage="No customers yet."
              />
            </section>

            <section className="flex flex-col gap-8">
              <h3 className="text-label font-semibold uppercase tracking-label text-ink-70">Cohort retention</h3>
              <p className="text-[11px] text-ink-70">
                Each row is customers whose first-ever order fell in that month; each column is the share still
                ordering M months later. Always all-time per cohort, regardless of the date filter above.
              </p>
              <CohortMatrix cohorts={query.data.cohorts} />
            </section>
          </div>
        ) : null}
      </ReportStateGate>
    </div>
  );
}
