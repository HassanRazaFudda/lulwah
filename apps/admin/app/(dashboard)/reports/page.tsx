import { Panel } from '../../../components/Panel';
import { PageHeader } from '../../../components/PageHeader';

/** plan.md §11.1 Reports — Sales/Products/Customers/Discounts/Inventory/
 *  Search/Traffic, all exportable to CSV/XLSX. Section shells only. */
const REPORTS = [
  'Sales', 'Products', 'Customers', 'Discounts', 'Inventory', 'Search', 'Traffic',
];

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Reports" description="Exportable to CSV/XLSX once apps/api ships the report endpoints" />
      <div className="grid grid-cols-2 gap-16 md:grid-cols-4">
        {REPORTS.map((report) => (
          <Panel key={report} title={report}>
            <p className="text-body-sm text-ink-70">No data yet.</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
