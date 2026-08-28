'use client';

import { useState } from 'react';
import { cx } from '@lulwah/ui';
import { PageHeader } from '../../../components/PageHeader';
import { SalesReportPanel } from '../../../components/reports/SalesReportPanel';
import { ProductsReportPanel } from '../../../components/reports/ProductsReportPanel';
import { CustomersReportPanel } from '../../../components/reports/CustomersReportPanel';
import { DiscountsReportPanel } from '../../../components/reports/DiscountsReportPanel';
import { InventoryReportPanel } from '../../../components/reports/InventoryReportPanel';
import { SearchReportPanel } from '../../../components/reports/SearchReportPanel';

/**
 * plan.md §11.1 Reports: "Sales ... Products ... Customers ... Discounts
 * ... Inventory ... Search ... Traffic (from GA4 API). All exportable to
 * CSV/XLSX." `apps/api/src/modules/report/` built real endpoints for the
 * first six (confirmed by reading `report.routes.ts`/`report.dto.ts`/
 * `report.service.ts`) — CSV export is real too (`report.controller.ts`'s
 * `?format=csv` branch), XLSX was never built anywhere in this repo (a
 * documented simplification in `report/csv.ts`'s own doc comment, not a
 * gap introduced here).
 *
 * **Traffic is deliberately not a working tab.** No GA4 (or any analytics)
 * integration exists anywhere in this codebase — `report.routes.ts`'s own
 * doc comment states this explicitly, plan.md §23 was never built. Rather
 * than silently dropping the category plan.md asked for, it stays in the
 * tab strip so anyone scanning this screen sees the same seven categories
 * the spec names, but selecting it shows a plain "not available" panel —
 * never a chart or table with invented numbers.
 */

type ReportTab = 'sales' | 'products' | 'customers' | 'discounts' | 'inventory' | 'search' | 'traffic';

const TABS: { id: ReportTab; label: string; available: boolean }[] = [
  { id: 'sales', label: 'Sales', available: true },
  { id: 'products', label: 'Products', available: true },
  { id: 'customers', label: 'Customers', available: true },
  { id: 'discounts', label: 'Discounts', available: true },
  { id: 'inventory', label: 'Inventory', available: true },
  { id: 'search', label: 'Search', available: true },
  { id: 'traffic', label: 'Traffic', available: false },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');

  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Reports" description="Sales, Products, Customers, Discounts, Inventory and Search — each exportable to CSV." />

      <div className="flex flex-wrap gap-4 border-b border-line" role="tablist" aria-label="Report category">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cx(
              'h-[40px] border-b-2 px-16 text-body-sm font-semibold transition-colors duration-fast ease-out',
              activeTab === tab.id
                ? 'border-zamurrad text-zamurrad'
                : 'border-transparent text-ink-70 hover:text-ink',
              !tab.available && activeTab !== tab.id && 'italic text-ink-70/60',
            )}
          >
            {tab.label}
            {!tab.available ? ' *' : ''}
          </button>
        ))}
      </div>

      {activeTab === 'sales' ? <SalesReportPanel /> : null}
      {activeTab === 'products' ? <ProductsReportPanel /> : null}
      {activeTab === 'customers' ? <CustomersReportPanel /> : null}
      {activeTab === 'discounts' ? <DiscountsReportPanel /> : null}
      {activeTab === 'inventory' ? <InventoryReportPanel /> : null}
      {activeTab === 'search' ? <SearchReportPanel /> : null}
      {activeTab === 'traffic' ? (
        <div className="flex flex-col items-start gap-8 border border-line bg-paper p-24">
          <p className="text-label font-semibold uppercase tracking-label text-ink-70">Not available</p>
          <p className="max-w-[560px] text-body-sm text-ink-70">
            Traffic reporting needs a Google Analytics 4 integration, which hasn't been built anywhere in this
            codebase yet (plan.md §23 remains unbuilt) — there is no real data source for this to read from. Rather
            than show invented numbers, this tab stays empty until that integration exists.
          </p>
        </div>
      ) : null}
    </div>
  );
}
