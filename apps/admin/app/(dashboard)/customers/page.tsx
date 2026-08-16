'use client';

import { formatMoney } from '@lulwah/utils';
import { DataTable } from '../../../components/DataTable';
import type { DataTableColumn } from '../../../components/DataTable';
import { PageHeader } from '../../../components/PageHeader';
import { PLACEHOLDER_CUSTOMERS } from '../../../lib/placeholder-misc';
import type { PlaceholderCustomerRow } from '../../../lib/placeholder-misc';

/** plan.md §11.1 Customers — list shell; profile/measurements/COD-risk
 *  detail panel is out of scope for this skeleton. */
const COLUMNS: DataTableColumn<PlaceholderCustomerRow>[] = [
  { id: 'name', header: 'Name', cell: (c) => c.name },
  { id: 'email', header: 'Email', cell: (c) => c.email },
  { id: 'orders', header: 'Orders', align: 'right', cell: (c) => c.orders },
  { id: 'spend', header: 'Total spent', align: 'right', cell: (c) => formatMoney(c.totalSpentFils, 'en') },
  {
    id: 'tags',
    header: 'Tags',
    cell: (c) => c.tags.map((tag) => tag).join(', ') || '—',
  },
];

export default function CustomersPage() {
  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Customers" description={`${PLACEHOLDER_CUSTOMERS.length} customers`} />
      <DataTable columns={COLUMNS} rows={PLACEHOLDER_CUSTOMERS} getRowId={(c) => c.id} />
    </div>
  );
}
