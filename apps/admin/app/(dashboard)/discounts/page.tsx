'use client';

import { DataTable } from '../../../components/DataTable';
import type { DataTableColumn } from '../../../components/DataTable';
import { PageHeader } from '../../../components/PageHeader';
import { PLACEHOLDER_DISCOUNTS } from '../../../lib/placeholder-misc';
import type { PlaceholderDiscountRow } from '../../../lib/placeholder-misc';

/** plan.md §11.1 Discounts — list shell; the builder/live-preview panel is
 *  out of scope for this skeleton. */
const COLUMNS: DataTableColumn<PlaceholderDiscountRow>[] = [
  { id: 'code', header: 'Code', cell: (d) => d.code },
  { id: 'type', header: 'Type', cell: (d) => d.type.replace(/_/g, ' ') },
  { id: 'status', header: 'Status', cell: (d) => d.status },
  { id: 'used', header: 'Used / Limit', align: 'right', cell: (d) => `${d.used} / ${d.limit || '∞'}` },
];

export default function DiscountsPage() {
  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Discounts" description={`${PLACEHOLDER_DISCOUNTS.length} discounts`} />
      <DataTable columns={COLUMNS} rows={PLACEHOLDER_DISCOUNTS} getRowId={(d) => d.code} />
    </div>
  );
}
