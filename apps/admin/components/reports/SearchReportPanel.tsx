'use client';

import { useState } from 'react';
import type { SearchQueryRow } from '@lulwah/contracts';
import { formatDateTime } from '@lulwah/utils';
import { DataTable } from '../DataTable';
import type { DataTableColumn } from '../DataTable';
import { buildQueryString } from '../../lib/queries/query-utils';
import { useSearchReportQuery } from '../../lib/queries/reports';
import { DateRangeFields, LimitSelect, ReportToolbar, ReportToolbarFields } from './ReportToolbar';
import { ExportCsvButton } from './ExportCsvButton';
import { ReportStateGate } from './ReportStateGate';

const COLUMNS: DataTableColumn<SearchQueryRow>[] = [
  { id: 'query', header: 'Query', cell: (r) => <span className="font-semibold text-ink">{r.query || '(empty)'}</span> },
  { id: 'count', header: 'Searches', align: 'right', cell: (r) => r.searchCount },
  { id: 'avgResults', header: 'Avg. results', align: 'right', cell: (r) => r.avgResultCount.toFixed(1) },
  { id: 'lastSearched', header: 'Last searched', cell: (r) => formatDateTime(r.lastSearchedAt, 'en') },
];

export function SearchReportPanel() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [limit, setLimit] = useState(20);

  const query = useSearchReportQuery({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit });

  const csvPath = `/admin/reports/search${buildQueryString({
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
        <ExportCsvButton path={csvPath} fallbackFilename="search-report.csv" />
      </ReportToolbar>

      <ReportStateGate isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {query.data ? (
          <div className="flex flex-col gap-24">
            <section className="flex flex-col gap-8">
              <h3 className="text-label font-semibold uppercase tracking-label text-ink-70">Top queries</h3>
              <DataTable
                columns={COLUMNS}
                rows={query.data.topQueries}
                getRowId={(r) => r.query}
                emptyMessage="No searches logged in this window."
              />
            </section>
            <section className="flex flex-col gap-8">
              <h3 className="text-label font-semibold uppercase tracking-label text-ink-70">Zero-result queries</h3>
              <p className="text-[11px] text-ink-70">
                Searches that returned nothing — a merchandising/catalogue-gap signal, not a bug list.
              </p>
              <DataTable
                columns={COLUMNS}
                rows={query.data.zeroResultQueries}
                getRowId={(r) => r.query}
                emptyMessage="No zero-result searches in this window."
              />
            </section>
          </div>
        ) : null}
      </ReportStateGate>
    </div>
  );
}
