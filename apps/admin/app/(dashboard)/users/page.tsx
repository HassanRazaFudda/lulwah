'use client';

import { cx } from '@lulwah/ui';
import { DataTable } from '../../../components/DataTable';
import type { DataTableColumn } from '../../../components/DataTable';
import { PageHeader } from '../../../components/PageHeader';

/** plan.md §11.1 Users & roles + §10.2's RBAC matrix. Role names shown
 *  here match §10.2 exactly; the invite/permission-editing flow is out of
 *  scope for this skeleton. */
interface StaffRow {
  name: string;
  email: string;
  role: string;
  twoFactor: 'enabled' | 'reset required';
}

const STAFF: StaffRow[] = [
  { name: 'Sara Ahmed', email: 'sara@lulwah.ae', role: 'order_ops', twoFactor: 'enabled' },
  { name: 'Imran Malik', email: 'imran@lulwah.ae', role: 'warehouse', twoFactor: 'enabled' },
  { name: 'Layla Hassan', email: 'layla@lulwah.ae', role: 'manager', twoFactor: 'reset required' },
];

const COLUMNS: DataTableColumn<StaffRow>[] = [
  { id: 'name', header: 'Name', cell: (u) => u.name },
  { id: 'email', header: 'Email', cell: (u) => u.email },
  { id: 'role', header: 'Role', cell: (u) => u.role.replace(/_/g, ' ') },
  {
    id: 'twoFactor',
    header: '2FA',
    cell: (u) => (
      <span
        className={cx(
          'rounded-sm border px-8 py-4 text-[10px] font-semibold uppercase tracking-label',
          u.twoFactor === 'enabled' ? 'border-success/40 bg-success/12 text-success' : 'border-warning/40 bg-warning/12 text-warning',
        )}
      >
        {u.twoFactor}
      </span>
    ),
  },
];

export default function UsersPage() {
  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Users & roles" description="plan.md §10.2 RBAC matrix — see role permissions there." />
      <DataTable columns={COLUMNS} rows={STAFF} getRowId={(u) => u.email} />
    </div>
  );
}
