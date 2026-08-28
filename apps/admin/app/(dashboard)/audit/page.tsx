'use client';

import { useMemo, useState } from 'react';
import type { AuditLogEntry, User } from '@lulwah/contracts';
import { formatDateTime } from '@lulwah/utils';
import { cx } from '@lulwah/ui';
import { DataTable } from '../../../components/DataTable';
import type { DataTableColumn } from '../../../components/DataTable';
import { PageHeader } from '../../../components/PageHeader';
import { Skeleton } from '../../../components/Skeleton';
import { AccessDenied } from '../../../components/AccessDenied';
import { isForbiddenError } from '../../../lib/api-client';
import { useAdminAuditLogQuery, useAdminUsersForAuditQuery } from '../../../lib/queries/audit';
import { AuditFilters, EMPTY_AUDIT_FILTERS } from '../../../components/audit/AuditFilters';
import type { AuditFilterState } from '../../../components/audit/AuditFilters';
import { AuditEntryDrawer } from '../../../components/audit/AuditEntryDrawer';
import { ColumnVisibilityMenu } from '../../../components/audit/ColumnVisibilityMenu';

/**
 * plan.md §11.1 Audit log: "Every mutating admin action, filterable by
 * actor/entity/date, with a before→after diff viewer." Backed by the real
 * `GET /admin/audit-log` (`apps/api/src/modules/audit/`) — this screen did
 * not exist before this task (checked `app/(dashboard)/` — no placeholder
 * route existed), so there's no prior version to compare against.
 *
 * Gated on `audit.read`, granted only to `super_admin`/`manager`
 * (`identity.policy.ts`'s `ROLE_PERMISSIONS` — see `audit.policy.ts`'s own
 * doc comment on why this is deliberately narrower than most `*.read`
 * permissions). A user without it gets `AccessDenied`, not a raw 403 or a
 * blank page.
 *
 * The diff viewer (`AuditEntryDrawer` → `AuditDiffViewer`) is labeled
 * "Request"/"Response," never "Before"/"After" — `AuditLogEntry`'s own doc
 * comment in `@lulwah/contracts` is explicit that this captures request
 * vs. response payloads, not a database before/after snapshot; see that
 * component's doc comment for the full reasoning.
 */

const METHOD_CLASSES: Record<string, string> = {
  POST: 'border-success/40 bg-success/12 text-success',
  PATCH: 'border-mukaish/50 bg-mukaish/15 text-ink-70',
  PUT: 'border-gold/50 bg-gold/20 text-gold-dark',
  DELETE: 'border-danger/40 bg-danger/12 text-danger',
};

const OPTIONAL_COLUMNS = [
  { id: 'role', label: 'Role' },
  { id: 'ip', label: 'IP' },
  { id: 'userAgent', label: 'User agent' },
  { id: 'requestId', label: 'Request ID' },
];

function formatActorLabel(entry: AuditLogEntry, userById: Map<string, User>): string {
  if (!entry.actorId) return 'Unauthenticated request';
  const user = userById.get(entry.actorId);
  if (!user) return entry.actorId;
  const name = `${user.firstName} ${user.lastName}`.trim();
  return user.email ? `${name || 'Unnamed'} <${user.email}>` : name || entry.actorId;
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState<AuditFilterState>(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['role']));

  const query = useAdminAuditLogQuery(
    {
      actorId: filters.actorId || undefined,
      entityType: filters.entityType || undefined,
      entityId: filters.entityId || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    },
    page,
  );
  const usersQuery = useAdminUsersForAuditQuery();

  const userById = useMemo(() => new Map((usersQuery.data ?? []).map((u) => [u.id, u])), [usersQuery.data]);

  const entityTypeSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const entry of query.data?.entries ?? []) {
      if (entry.entityType) set.add(entry.entityType);
    }
    return Array.from(set).sort();
  }, [query.data]);

  function updateFilters(next: AuditFilterState): void {
    setFilters(next);
    setPage(1);
  }

  function toggleColumn(id: string): void {
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (query.isError && isForbiddenError(query.error)) {
    return (
      <div className="flex flex-col gap-16">
        <PageHeader title="Audit log" description="Every mutating admin action, filterable by actor/entity/date." />
        <AccessDenied permission="audit.read" description="The audit log is restricted to super admins and managers." />
      </div>
    );
  }

  const columns: DataTableColumn<AuditLogEntry>[] = [
    { id: 'date', header: 'Date', cell: (e) => formatDateTime(e.createdAt, 'en') },
    { id: 'actor', header: 'Actor', cell: (e) => formatActorLabel(e, userById) },
  ];
  if (visibleColumns.has('role')) {
    columns.push({ id: 'role', header: 'Role', cell: (e) => (e.actorRole ? e.actorRole.replace(/_/g, ' ') : '—') });
  }
  columns.push(
    {
      id: 'method',
      header: 'Method',
      cell: (e) => (
        <span
          className={cx(
            'inline-flex h-20 items-center rounded-sm border px-8 text-[10px] font-semibold uppercase tracking-label',
            METHOD_CLASSES[e.method] ?? 'border-line text-ink-70',
          )}
        >
          {e.method}
        </span>
      ),
    },
    { id: 'action', header: 'Action', cell: (e) => <span className="font-mono text-[12px]">{e.action}</span> },
    {
      id: 'entity',
      header: 'Entity',
      cell: (e) => (e.entityType ? `${e.entityType}${e.entityId ? ` / ${e.entityId.slice(-6)}` : ''}` : '—'),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'right',
      cell: (e) => <span className={e.statusCode >= 400 ? 'font-semibold text-danger' : undefined}>{e.statusCode}</span>,
    },
  );
  if (visibleColumns.has('ip')) {
    columns.push({ id: 'ip', header: 'IP', cell: (e) => e.ip ?? '—' });
  }
  if (visibleColumns.has('userAgent')) {
    columns.push({
      id: 'userAgent',
      header: 'User agent',
      cell: (e) => (
        <span className="block max-w-[220px] truncate text-[11px]" title={e.userAgent ?? undefined}>
          {e.userAgent ?? '—'}
        </span>
      ),
    });
  }
  if (visibleColumns.has('requestId')) {
    columns.push({
      id: 'requestId',
      header: 'Request ID',
      cell: (e) => <span className="font-mono text-[11px]">{e.requestId ?? '—'}</span>,
    });
  }

  const entries = query.data?.entries ?? [];
  const total = query.data?.total ?? 0;
  const limit = query.data?.limit ?? 50;
  const hasMore = query.data?.hasMore ?? false;
  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  return (
    <div className="flex flex-col gap-16">
      <PageHeader
        title="Audit log"
        description={
          query.data
            ? `${total} entr${total === 1 ? 'y' : 'ies'}${hasActiveFilters ? ' matching these filters' : ''}`
            : 'Every mutating admin action, filterable by actor/entity/date.'
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-8">
        <AuditFilters
          filters={filters}
          onChange={updateFilters}
          users={usersQuery.data}
          entityTypeSuggestions={entityTypeSuggestions}
        />
        <ColumnVisibilityMenu options={OPTIONAL_COLUMNS} visible={visibleColumns} onToggle={toggleColumn} />
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-8">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-[36px]" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-start gap-8 border border-line bg-paper p-16">
          <p className="text-body-sm text-danger">
            {query.error instanceof Error ? query.error.message : 'Failed to load the audit log.'}
          </p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="text-body-sm font-semibold text-zamurrad underline underline-offset-4"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={entries}
            getRowId={(e) => e.id}
            onRowClick={(e) => setSelectedEntry(e)}
            emptyMessage="No matching audit entries."
          />
          <div className="flex items-center justify-between gap-16">
            <p className="text-body-sm text-ink-70">
              Page {page} of {Math.max(1, Math.ceil(total / limit))} — {total} total
            </p>
            <div className="flex gap-8">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-[36px] border border-line bg-paper px-16 text-body-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="h-[36px] border border-line bg-paper px-16 text-body-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {selectedEntry ? (
        <AuditEntryDrawer
          entry={selectedEntry}
          actorLabel={formatActorLabel(selectedEntry, userById)}
          onClose={() => setSelectedEntry(null)}
        />
      ) : null}
    </div>
  );
}
