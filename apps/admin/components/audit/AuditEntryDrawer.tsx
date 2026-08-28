'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { AuditLogEntry } from '@lulwah/contracts';
import { formatDateTime } from '@lulwah/utils';
import { cx } from '@lulwah/ui';
import { AuditDiffViewer } from './AuditDiffViewer';

export interface AuditEntryDrawerProps {
  entry: AuditLogEntry;
  /** Resolved "Name <email>" for `entry.actorId`, if the actor picker's
   *  own `GET /admin/users` fetch succeeded — falls back to the raw id
   *  when it didn't (see `queries/audit.ts#useAdminUsersForAuditQuery`'s
   *  doc comment on why that's a separate, best-effort query). */
  actorLabel: string;
  onClose: () => void;
}

/** Only entity types this app actually has a real detail route for — a
 *  wrong guess here would be a dead link, so this stays a short, verified
 *  allowlist rather than a generic `/${entityType}/${entityId}` template. */
const ENTITY_DETAIL_ROUTES: Record<string, (id: string) => string> = {
  orders: (id) => `/orders/${id}`,
  products: (id) => `/products/${id}`,
  inventory: (id) => `/inventory/${id}`,
};

export function AuditEntryDrawer({ entry, actorLabel, onClose }: AuditEntryDrawerProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const detailHref = entry.entityType && entry.entityId ? ENTITY_DETAIL_ROUTES[entry.entityType]?.(entry.entityId) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div className="relative flex h-full w-full max-w-[720px] flex-col gap-16 overflow-y-auto border-l border-line bg-paper p-24">
        <div className="flex items-start justify-between gap-16">
          <div>
            <p className="font-mono text-label font-semibold text-ink">{entry.action}</p>
            <p className="mt-4 text-body-sm text-ink-70">{formatDateTime(entry.createdAt, 'en')}</p>
          </div>
          <button type="button" onClick={onClose} className="text-body-sm font-semibold text-ink-70 hover:text-ink">
            Close ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-16 border border-line bg-nacre p-16 text-body-sm sm:grid-cols-3">
          <Field label="Actor" value={actorLabel} />
          <Field label="Role" value={entry.actorRole ?? '—'} />
          <Field label="Status code" value={String(entry.statusCode)} />
          <Field label="Entity type" value={entry.entityType ?? '—'} />
          <Field label="Entity ID" value={entry.entityId ?? '—'} mono />
          <Field label="IP" value={entry.ip ?? '—'} />
          <Field label="Request ID" value={entry.requestId ?? '—'} mono />
          <Field label="User agent" value={entry.userAgent ?? '—'} className="col-span-2 sm:col-span-3" />
        </div>

        {detailHref ? (
          <Link href={detailHref} className="self-start text-body-sm font-semibold text-zamurrad underline underline-offset-4">
            View {entry.entityType} record →
          </Link>
        ) : null}

        <AuditDiffViewer requestBody={entry.requestBody} responseBody={entry.responseBody} />
      </div>
    </div>
  );
}

function Field({ label, value, mono, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-label text-ink-70">{label}</p>
      <p className={cx('break-words text-ink', mono && 'font-mono text-[12px]')}>{value}</p>
    </div>
  );
}
