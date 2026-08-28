'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { User, UserRole, UserStatus } from '@lulwah/contracts';
import { formatDateTime } from '@lulwah/utils';
import { Button, cx } from '@lulwah/ui';
import { DataTable } from '../../../components/DataTable';
import type { DataTableColumn } from '../../../components/DataTable';
import { PageHeader } from '../../../components/PageHeader';
import { Panel } from '../../../components/Panel';
import { Skeleton } from '../../../components/Skeleton';
import { selectClassName } from '../../../components/product-editor/field-styles';
import { getSessionUser } from '../../../lib/auth-session';
import { ROLE_LABELS, STAFF_ROLES, useAdminUsersQuery, useUpdateUserRoleMutation } from '../../../lib/queries/users';

/**
 * plan.md §11.1 Users & roles + §10.2's RBAC matrix, now real data against
 * `GET /admin/users` and a real role-change control against
 * `PATCH /admin/users/:id/role`.
 *
 * **What this screen deliberately does NOT build, and why**: plan.md
 * §11.1 also lists "Invite staff... force 2FA reset, deactivate, session
 * list with revoke" for this screen. None of those have a backing
 * endpoint anywhere in `apps/api` — `identity.routes.ts` has exactly two
 * admin routes, list and role-change (see `lib/queries/users.ts`'s doc
 * comment, which cites the exact file checked). Rather than silently
 * omitting them or wiring buttons to nothing, they're rendered below as
 * visibly disabled controls with an explanatory title/tooltip, and the
 * gap is called out in the panel above the table too — the same
 * "state the gap in the UI itself" precedent `orders/[id]/page.tsx` sets
 * for `internalNotes` not being readable back.
 */

const ROLE_FILTER_OPTIONS: Array<{ value: 'all' | UserRole; label: string }> = [
  { value: 'all', label: 'All roles' },
  ...(['customer', 'support', 'catalog', 'order_ops', 'warehouse', 'content', 'finance', 'manager', 'super_admin'] as UserRole[]).map(
    (role) => ({ value: role, label: ROLE_LABELS[role] }),
  ),
];

const STATUS_STYLES: Record<UserStatus, string> = {
  active: 'border-success/40 bg-success/12 text-success',
  suspended: 'border-warning/40 bg-warning/12 text-warning',
  deleted: 'border-danger/40 bg-danger/12 text-danger',
};

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={cx('rounded-sm border px-8 py-4 text-[10px] font-semibold uppercase tracking-label', className)}>
      {children}
    </span>
  );
}

/** A disabled control representing plan.md §11.1 functionality this
 *  codebase has no endpoint for yet — never wired to a mutation, per this
 *  task's explicit instruction not to build a button that calls a
 *  nonexistent endpoint or silently does nothing. */
function ComingSoonButton({ label, reason }: { label: string; reason: string }) {
  return (
    <button
      type="button"
      disabled
      title={reason}
      className="cursor-not-allowed rounded-sm border border-line px-8 py-4 text-[11px] font-semibold uppercase tracking-label text-ink-70 opacity-50"
    >
      {label}
    </button>
  );
}

export default function UsersPage() {
  const { data: users, isLoading } = useAdminUsersQuery();
  const updateRole = useUpdateUserRoleMutation();
  const sessionUser = getSessionUser();

  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<UserRole | ''>('');
  const [confirmText, setConfirmText] = useState('');

  const filteredUsers = (users ?? []).filter((u) => roleFilter === 'all' || u.role === roleFilter);
  const pendingUser = pendingUserId ? (users ?? []).find((u) => u.id === pendingUserId) : undefined;
  const isSelf = pendingUser && sessionUser && pendingUser.id === sessionUser.id;
  const canConfirm =
    !!pendingUser && !!pendingRole && pendingRole !== pendingUser.role && confirmText.trim() === pendingRole && !isSelf;

  const startRoleChange = (user: User) => {
    setPendingUserId(user.id);
    setPendingRole(user.role);
    setConfirmText('');
  };
  const cancelRoleChange = () => {
    setPendingUserId(null);
    setPendingRole('');
    setConfirmText('');
  };
  const confirmRoleChange = () => {
    if (!pendingUser || !pendingRole || !canConfirm) return;
    updateRole.mutate(
      { userId: pendingUser.id, role: pendingRole },
      { onSuccess: cancelRoleChange },
    );
  };

  const columns: DataTableColumn<User>[] = [
    { id: 'name', header: 'Name', cell: (u) => `${u.firstName} ${u.lastName}`.trim() || '—' },
    { id: 'email', header: 'Email', cell: (u) => u.email ?? '—' },
    {
      id: 'role',
      header: 'Role',
      cell: (u) => (
        <div className="flex flex-col gap-4">
          <Pill className="w-fit border-line bg-nacre text-ink">{ROLE_LABELS[u.role]}</Pill>
          {u.permissions.length > 0 ? (
            <span className="text-body-sm text-ink-70">+{u.permissions.length} extra permission(s)</span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (u) => <Pill className={STATUS_STYLES[u.status]}>{u.status}</Pill>,
    },
    { id: 'created', header: 'Created', cell: (u) => formatDateTime(u.createdAt, 'en') },
    {
      id: 'actions',
      header: 'Actions',
      cell: (u) => (
        <div className="flex flex-wrap items-center gap-8">
          <Button
            type="button"
            variant="tertiary"
            onClick={() => startRoleChange(u)}
            disabled={updateRole.isPending && pendingUserId === u.id}
          >
            Change role
          </Button>
          <ComingSoonButton label="Reset 2FA" reason="No 2FA-reset endpoint exists in apps/api yet." />
          <ComingSoonButton label="Deactivate" reason="No deactivate endpoint exists in apps/api yet." />
          <ComingSoonButton label="Sessions" reason="No session-list/revoke endpoint exists in apps/api yet." />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-16">
      <PageHeader
        title="Users & roles"
        description="plan.md §10.2 RBAC matrix — see role permissions there."
        actions={<ComingSoonButton label="Invite staff" reason="No invite endpoint exists in apps/api yet." />}
      />

      <Panel title="What's real here">
        <p className="text-body-sm text-ink-70">
          The list below and the role-change control are real, live against <code>GET /admin/users</code> and{' '}
          <code>PATCH /admin/users/:id/role</code>. Invite, 2FA reset, deactivate, and session revoke are shown as
          disabled controls, not omitted, because <code>apps/api</code> has no endpoints for them yet — a real,
          currently-missing piece of admin functionality worth a future phase, not a UI oversight.
        </p>
      </Panel>

      <div className="flex flex-wrap items-center gap-16">
        <div className="flex flex-col gap-4">
          <label htmlFor="role-filter" className="text-label font-semibold uppercase tracking-label text-ink-70">
            Filter by role
          </label>
          <select
            id="role-filter"
            className={selectClassName}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
          >
            {ROLE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <p className="pt-20 text-body-sm text-ink-70">
          {isLoading ? 'Loading…' : `${filteredUsers.length} of ${users?.length ?? 0} account(s) shown`}
        </p>
      </div>

      {pendingUser ? (
        <Panel title="Change role — typed confirmation required">
          <div className="flex flex-col gap-12">
            <p className="text-body-sm text-ink">
              Changing <strong>{pendingUser.email ?? pendingUser.id}</strong>&apos;s role from{' '}
              <strong>{ROLE_LABELS[pendingUser.role]}</strong> to:
            </p>
            <select
              className={selectClassName + ' max-w-[280px]'}
              value={pendingRole}
              onChange={(e) => {
                setPendingRole(e.target.value as UserRole);
                setConfirmText('');
              }}
            >
              {STAFF_ROLES.concat('customer').map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>

            {isSelf ? (
              <p className="text-body-sm text-danger">
                You cannot change your own role from this screen — a client-side safety guard only, not an API
                restriction (identity.service.ts#updateUserRoleAsAdmin has no self-edit check of its own).
              </p>
            ) : pendingRole && pendingRole !== pendingUser.role ? (
              <div className="flex flex-col gap-4">
                <label htmlFor="confirm-role" className="text-body-sm text-ink">
                  This is a meaningful permission change. Type the new role exactly (
                  <code>{pendingRole}</code>) to confirm:
                </label>
                <input
                  id="confirm-role"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={pendingRole}
                  className="h-[40px] max-w-[280px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
                />
              </div>
            ) : null}

            {updateRole.isError ? <p className="text-body-sm text-danger">{updateRole.error.message}</p> : null}

            <div className="flex gap-8">
              <Button type="button" onClick={confirmRoleChange} disabled={!canConfirm || updateRole.isPending}>
                {updateRole.isPending ? 'Applying…' : 'Confirm role change'}
              </Button>
              <Button type="button" variant="tertiary" onClick={cancelRoleChange} disabled={updateRole.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[40px]" />
          ))}
        </div>
      ) : (
        <DataTable columns={columns} rows={filteredUsers} getRowId={(u) => u.id} emptyMessage="No users match this filter." />
      )}
    </div>
  );
}
