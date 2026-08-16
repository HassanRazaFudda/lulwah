'use client';

import { cx } from '@lulwah/ui';
import { DataTable } from '../../../components/DataTable';
import type { DataTableColumn } from '../../../components/DataTable';
import { PageHeader } from '../../../components/PageHeader';
import { PLACEHOLDER_INVENTORY } from '../../../lib/placeholder-misc';
import type { PlaceholderInventoryRow } from '../../../lib/placeholder-misc';

/** plan.md §11.1 Inventory — variant-level grid shell; low-stock highlight
 *  only, per this task's "minimal placeholder content" scope. */
const COLUMNS: DataTableColumn<PlaceholderInventoryRow>[] = [
  { id: 'sku', header: 'SKU', cell: (r) => r.sku },
  { id: 'product', header: 'Product', cell: (r) => r.product },
  {
    id: 'onHand',
    header: 'On hand',
    align: 'right',
    cell: (r) => (
      <span className={cx('font-semibold', r.onHand <= r.threshold && 'text-danger')}>{r.onHand}</span>
    ),
  },
  { id: 'reserved', header: 'Reserved', align: 'right', cell: (r) => r.reserved },
  { id: 'threshold', header: 'Low-stock threshold', align: 'right', cell: (r) => r.threshold },
];

export default function InventoryPage() {
  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Inventory" description={`${PLACEHOLDER_INVENTORY.length} variants`} />
      <DataTable columns={COLUMNS} rows={PLACEHOLDER_INVENTORY} getRowId={(r) => r.sku} />
    </div>
  );
}
