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
import { selectClassName, labelClassName } from '../../../components/product-editor/field-styles';
import { getSessionUser } from '../../../lib/auth-session';
import {
  ROLE_LABELS,
  STAFF_ROLES,
  useAdminUsersQuery,
  useInviteStaffMutation,
  useRevokeSessionMutation,
  useUpdateUserRoleMutation,
  useUpdateUserStatusMutation,
  useUserSessionsQuery,
} from '../../../lib/queries/users';
import type { InviteStaffResult } from '../../../lib/queries/users';

/**
 * plan.md §11.1 Users & roles + §10.2's RBAC matrix.
 *
 * **What this screen now builds for real, beyond list + role-change**:
 * invite staff, deactivate/reactivate, and session-list-with-revoke are
 * all real against `apps/api`'s `identity` module (see
 * `lib/queries/users.ts`'s doc comment for the exact endpoints) —
 * docs/implemented-plan.md §6.10/§11 item 8's gap, closed for three of
 * the four actions plan.md §11.1 names.
 *
 * **What's still deliberately NOT built, and why**: "Force 2FA reset"
 * stays a visibly disabled "coming soon" control. No real TOTP/2FA system
 * exists anywhere in this codebase — the login page's TOTP field has
 * never verified against anything real (docs/implemented-plan.md §6.2) —
 * so there is nothing genuine to reset. Building a reset button against a
 * feature that was never real would be a worse gap than the honest
 * disabled control this screen already had.
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

const inputClassName = 'h-[40px] w-full border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad';

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={cx('rounded-sm border px-8 py-4 text-[10px] font-semibold uppercase tracking-label', className)}>
      {children}
    </span>
  );
}

/** A disabled control representing plan.md §11.1 functionality this
 *  codebase has no real backing for — "Force 2FA reset" is the one
 *  survivor of this pattern now that invite/deactivate/sessions are real
 *  (see this file's own top comment for why). */
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

const UAE_PHONE_RE = /^5\d{8}$/;

interface InviteFormState {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: UserRole;
}

const EMPTY_INVITE_FORM: InviteFormState = { email: '', firstName: '', lastName: '', phoneNumber: '', role: 'support' };

export default function UsersPage() {
  const { data: users, isLoading } = useAdminUsersQuery();
  const updateRole = useUpdateUserRoleMutation();
  const updateStatus = useUpdateUserStatusMutation();
  const inviteStaff = useInviteStaffMutation();
  const sessionUser = getSessionUser();

  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<UserRole | ''>('');
  const [confirmText, setConfirmText] = useState('');

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormState>(EMPTY_INVITE_FORM);
  const [inviteResult, setInviteResult] = useState<InviteStaffResult | null>(null);

  const [sessionsUserId, setSessionsUserId] = useState<string | null>(null);

  const filteredUsers = (users ?? []).filter((u) => roleFilter === 'all' || u.role === roleFilter);
  const pendingUser = pendingUserId ? (users ?? []).find((u) => u.id === pendingUserId) : undefined;
  const isSelf = pendingUser && sessionUser && pendingUser.id === sessionUser.id;
  const canConfirm =
    !!pendingUser && !!pendingRole && pendingRole !== pendingUser.role && confirmText.trim() === pendingRole && !isSelf;

  const sessionsUser = sessionsUserId ? (users ?? []).find((u) => u.id === sessionsUserId) : undefined;

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

  const isInviteFormValid =
    inviteForm.email.trim().length > 0 &&
    inviteForm.firstName.trim().length > 0 &&
    inviteForm.lastName.trim().length > 0 &&
    UAE_PHONE_RE.test(inviteForm.phoneNumber.trim());

  const submitInvite = () => {
    if (!isInviteFormValid) return;
    inviteStaff.mutate(
      {
        email: inviteForm.email.trim(),
        firstName: inviteForm.firstName.trim(),
        lastName: inviteForm.lastName.trim(),
        phone: { countryCode: '+971', number: inviteForm.phoneNumber.trim() },
        role: inviteForm.role,
      },
      {
        onSuccess: (result) => {
          setInviteResult(result);
          setInviteForm(EMPTY_INVITE_FORM);
          setShowInviteForm(false);
        },
      },
    );
  };

  const toggleStatus = (user: User) => {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    const verb = nextStatus === 'suspended' ? 'deactivate' : 'reactivate';
    const confirmed = window.confirm(
      nextStatus === 'suspended'
        ? `Deactivate ${user.email ?? user.id}? This immediately revokes their active sessions and blocks their next login. This can be undone.`
        : `Reactivate ${user.email ?? user.id}? They will be able to log in again.`,
    );
    if (!confirmed) return;
    updateStatus.mutate(
      { userId: user.id, status: nextStatus },
      { onError: () => window.alert(`Failed to ${verb} this account. See the console for details.`) },
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
      cell: (u) => {
        const isSelfRow = !!sessionUser && sessionUser.id === u.id;
        return (
          <div className="flex flex-wrap items-center gap-8">
            <Button
              type="button"
              variant="tertiary"
              onClick={() => startRoleChange(u)}
              disabled={updateRole.isPending && pendingUserId === u.id}
            >
              Change role
            </Button>
            <ComingSoonButton label="Reset 2FA" reason="No real TOTP/2FA system exists anywhere in this codebase, so there is nothing to reset." />
            {u.status === 'deleted' ? (
              <ComingSoonButton label="Deactivate" reason="This account is already deleted." />
            ) : (
              <Button
                type="button"
                variant="tertiary"
                onClick={() => toggleStatus(u)}
                disabled={isSelfRow || (updateStatus.isPending && updateStatus.variables?.userId === u.id)}
                title={isSelfRow ? 'You cannot deactivate your own account from this screen.' : undefined}
              >
                {u.status === 'suspended' ? 'Reactivate' : 'Deactivate'}
              </Button>
            )}
            <Button type="button" variant="tertiary" onClick={() => setSessionsUserId(u.id)}>
              Sessions
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-16">
      <PageHeader
        title="Users & roles"
        description="plan.md §10.2 RBAC matrix: see role permissions there."
        actions={
          <Button type="button" onClick={() => setShowInviteForm((v) => !v)}>
            {showInviteForm ? 'Cancel invite' : 'Invite staff'}
          </Button>
        }
      />

      <Panel title="What's real here">
        <p className="text-body-sm text-ink-70">
          List, role-change, invite, deactivate/reactivate, and session list + revoke are all real, live against{' '}
          <code>apps/api</code>&apos;s <code>identity</code> module. <strong>Force 2FA reset</strong> is still shown as a
          disabled control, because no real TOTP/2FA system exists anywhere in this codebase, so there is nothing genuine to
          reset yet.
        </p>
      </Panel>

      {showInviteForm ? (
        <Panel title="Invite staff">
          <div className="flex flex-col gap-12">
            <div className="grid grid-cols-1 gap-12 sm:grid-cols-2">
              <div className="flex flex-col gap-4">
                <label htmlFor="invite-email" className={labelClassName}>
                  Email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  className={inputClassName}
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-4">
                <label htmlFor="invite-role" className={labelClassName}>
                  Role
                </label>
                <select
                  id="invite-role"
                  className={selectClassName}
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                >
                  {STAFF_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-4">
                <label htmlFor="invite-first-name" className={labelClassName}>
                  First name
                </label>
                <input
                  id="invite-first-name"
                  className={inputClassName}
                  value={inviteForm.firstName}
                  onChange={(e) => setInviteForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-4">
                <label htmlFor="invite-last-name" className={labelClassName}>
                  Last name
                </label>
                <input
                  id="invite-last-name"
                  className={inputClassName}
                  value={inviteForm.lastName}
                  onChange={(e) => setInviteForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-4">
                <label htmlFor="invite-phone" className={labelClassName}>
                  Mobile (UAE, no leading 0; e.g. 501234567)
                </label>
                <div className="flex items-center gap-8">
                  <span className="text-body-sm text-ink-70">+971</span>
                  <input
                    id="invite-phone"
                    className={inputClassName}
                    value={inviteForm.phoneNumber}
                    onChange={(e) => setInviteForm((f) => ({ ...f, phoneNumber: e.target.value.replace(/\D/g, '') }))}
                    placeholder="501234567"
                    maxLength={9}
                  />
                </div>
              </div>
            </div>

            <p className="text-body-sm text-ink-70">
              A temporary password is generated and shown once below. There is no email-sending infrastructure in this
              codebase, so hand it to the new hire directly.
            </p>

            {inviteStaff.isError ? <p className="text-body-sm text-danger">{inviteStaff.error.message}</p> : null}

            <div className="flex gap-8">
              <Button type="button" onClick={submitInvite} disabled={!isInviteFormValid || inviteStaff.isPending}>
                {inviteStaff.isPending ? 'Creating…' : 'Create account'}
              </Button>
              <Button type="button" variant="tertiary" onClick={() => setShowInviteForm(false)} disabled={inviteStaff.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {inviteResult ? (
        <Panel title="Staff account created: copy this password now">
          <div className="flex flex-col gap-12">
            <p className="text-body-sm text-ink">
              <strong>{inviteResult.user.email}</strong> ({ROLE_LABELS[inviteResult.user.role]}) can log in with the
              temporary password below. It is shown <strong>once</strong>: it is never stored anywhere in plaintext and
              cannot be retrieved again after you leave this screen.
            </p>
            <code className="w-fit border border-line bg-nacre px-16 py-8 text-body-sm text-ink">
              {inviteResult.temporaryPassword}
            </code>
            <div>
              <Button type="button" variant="tertiary" onClick={() => setInviteResult(null)}>
                Done, I&apos;ve copied it
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {sessionsUserId ? (
        <SessionsPanel
          userId={sessionsUserId}
          userLabel={sessionsUser?.email ?? sessionsUserId}
          onClose={() => setSessionsUserId(null)}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-16">
        <div className="flex flex-col gap-4">
          <label htmlFor="role-filter" className={labelClassName}>
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
        <Panel title="Change role: typed confirmation required">
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
                You cannot change your own role from this screen. This is a client-side safety guard only, not an API
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

/** plan.md §11.1's "session list with revoke" — real against `identity`'s
 *  `Session` collection (see `identity.repository.ts
 *  #findActiveSessionsForUser`'s doc comment for exactly what "one row"
 *  means against a rotating-refresh-token store: one per still-logged-in
 *  device, not a full rotation history). */
function SessionsPanel({ userId, userLabel, onClose }: { userId: string; userLabel: string; onClose: () => void }) {
  const { data: sessions, isLoading } = useUserSessionsQuery(userId);
  const revokeSession = useRevokeSessionMutation();

  return (
    <Panel
      title={`Active sessions: ${userLabel}`}
      actions={
        <Button type="button" variant="tertiary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {isLoading ? (
        <Skeleton className="h-[80px]" />
      ) : !sessions || sessions.length === 0 ? (
        <p className="text-body-sm text-ink-70">No active sessions. Every session for this account has expired or been revoked.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {sessions.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-8 border border-line px-16 py-12">
              <div className="flex flex-col gap-4">
                <span className="text-body-sm text-ink">{s.userAgent ?? 'Unknown device'}</span>
                <span className="text-body-sm text-ink-70">
                  IP {s.ip ?? 'unknown'} · signed in {formatDateTime(s.createdAt, 'en')} · expires {formatDateTime(s.expiresAt, 'en')}
                </span>
              </div>
              <Button
                type="button"
                variant="tertiary"
                onClick={() => revokeSession.mutate({ userId, sessionId: s.id })}
                disabled={revokeSession.isPending && revokeSession.variables?.sessionId === s.id}
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}
      {revokeSession.isError ? <p className="mt-8 text-body-sm text-danger">{revokeSession.error.message}</p> : null}
    </Panel>
  );
}
