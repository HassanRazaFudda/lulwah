'use client';

import { useState } from 'react';
import type { InventoryAgeingBucket, LowStockRow } from '@lulwah/contracts';
import { formatMoney } from '@lulwah/utils';
import { DataTable } from '../DataTable';
import type { DataTableColumn } from '../DataTable';
import { buildQueryString } from '../../lib/queries/query-utils';
import { useInventoryReportQuery } from '../../lib/queries/reports';
import { ReportToolbar, ReportToolbarFields } from './ReportToolbar';
import { ExportCsvButton } from './ExportCsvButton';
import { ReportStateGate } from './ReportStateGate';

const BUCKET_LABELS: Record<InventoryAgeingBucket['bucket'], string> = {
  '0_30': '0–30 days',
  '31_60': '31–60 days',
  '61_90': '61–90 days',
  '90_plus': '90+ days',
};

const AGEING_COLUMNS: DataTableColumn<InventoryAgeingBucket>[] = [
  { id: 'bucket', header: 'Age since listed', cell: (r) => BUCKET_LABELS[r.bucket] },
  { id: 'variants', header: 'Variants', align: 'right', cell: (r) => r.variantCount },
  { id: 'units', header: 'Units on hand', align: 'right', cell: (r) => r.unitsOnHand },
  { id: 'value', header: 'Value at cost', align: 'right', cell: (r) => formatMoney(r.valueAtCostFils, 'en') },
];

const LOW_STOCK_COLUMNS: DataTableColumn<LowStockRow>[] = [
  { id: 'title', header: 'Title', cell: (r) => <span className="font-semibold text-ink">{r.title}</span> },
  { id: 'sku', header: 'SKU', cell: (r) => r.sku },
  { id: 'onHand', header: 'On hand', align: 'right', cell: (r) => r.onHand },
  { id: 'available', header: 'Available', align: 'right', cell: (r) => r.available },
  { id: 'threshold', header: 'Threshold', align: 'right', cell: (r) => r.lowStockThreshold },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-label text-ink-70">{label}</p>
      <p className="text-body-sm font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

/** No date range — `InventoryReportQuery` (report.dto.ts) has no
 *  `dateFrom`/`dateTo` at all; stock levels and ageing buckets are both
 *  "as of right now" snapshots, not something a window could apply to. */
export function InventoryReportPanel() {
  const [lowStockLimit, setLowStockLimit] = useState(100);

  const query = useInventoryReportQuery(lowStockLimit);

  const csvPath = `/admin/reports/inventory${buildQueryString({ lowStockLimit, format: 'csv' })}`;

  return (
    <div className="flex flex-col gap-16">
      <ReportToolbar>
        <ReportToolbarFields>
          <label className="flex items-center gap-8 text-body-sm text-ink-70">
            Low-stock rows
            <input
              type="number"
              min={1}
              max={500}
              value={lowStockLimit}
              onChange={(event) => setLowStockLimit(Math.max(1, Math.min(500, Number(event.target.value) || 1)))}
              className="h-[40px] w-[96px] border border-line bg-paper px-12 text-body-sm text-ink outline-none focus:border-zamurrad"
            />
          </label>
        </ReportToolbarFields>
        <ExportCsvButton path={csvPath} fallbackFilename="inventory-report-low-stock.csv" />
      </ReportToolbar>

      <ReportStateGate isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {query.data ? (
          <div className="flex flex-col gap-24">
            <div className="flex flex-wrap gap-24 border border-line bg-paper p-16">
              <Stat label="Units on hand" value={query.data.totalUnitsOnHand.toLocaleString('en-AE')} />
              <Stat label="Value at cost" value={formatMoney(query.data.totalValueAtCostFils, 'en')} />
              <Stat label="Value at retail" value={formatMoney(query.data.totalValueAtRetailFils, 'en')} />
              <Stat label="Low-stock variants" value={String(query.data.lowStockCount)} />
            </div>

            <section className="flex flex-col gap-8">
              <h3 className="text-label font-semibold uppercase tracking-label text-ink-70">Stock ageing</h3>
              <p className="text-[11px] text-ink-70">
                "Age" is days since the variant was first listed, not days since it was last restocked — a
                documented simplification (no per-restock history is aggregated here).
              </p>
              <DataTable columns={AGEING_COLUMNS} rows={query.data.ageing} getRowId={(r) => r.bucket} />
            </section>

            <section className="flex flex-col gap-8">
              <h3 className="text-label font-semibold uppercase tracking-label text-ink-70">
                Low stock ({query.data.lowStockCount})
              </h3>
              <DataTable
                columns={LOW_STOCK_COLUMNS}
                rows={query.data.lowStock}
                getRowId={(r) => r.variantId}
                emptyMessage="Nothing below its low-stock threshold."
              />
            </section>
          </div>
        ) : null}
      </ReportStateGate>
    </div>
  );
}
