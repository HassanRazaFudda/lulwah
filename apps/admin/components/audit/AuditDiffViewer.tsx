'use client';

import { useMemo, useState } from 'react';
import { cx } from '@lulwah/ui';
import { buildDiffRows } from '../../lib/audit-diff';
import type { DiffStatus } from '../../lib/audit-diff';

export interface AuditDiffViewerProps {
  requestBody: unknown;
  responseBody: unknown;
}

const STATUS_LABEL: Record<DiffStatus, string> = {
  match: 'Match',
  differs: 'Differs',
  requestOnly: 'Request only',
  responseOnly: 'Response only',
};

const STATUS_CLASSES: Record<DiffStatus, string> = {
  match: 'text-ink-70',
  differs: 'border border-warning/40 bg-warning/12 text-warning',
  requestOnly: 'border border-line bg-pearl text-ink-70',
  responseOnly: 'border border-line bg-pearl text-ink-70',
};

/**
 * plan.md §11.1's Audit log row asks for "a before→after diff viewer" —
 * this is that viewer, deliberately relabeled. `AuditLogEntry` (`@lulwah/
 * contracts`' `audit.ts`) does NOT capture a database before/after
 * snapshot — see that file's own doc comment — it captures the request
 * payload sent to the API and the response payload it returned. Calling
 * these panes "Before"/"After" would claim a precision this data doesn't
 * have, so they're labeled "Request"/"Response" here instead, with the
 * distinction stated in the caption, not just implied by the label.
 *
 * Two views: a flattened field-by-field diff (the default — usually more
 * scannable for a typical small request against a large response entity)
 * and the two raw JSON bodies side by side (for cases — reordered arrays,
 * deeply nested structures — the flattened view doesn't represent well).
 */
export function AuditDiffViewer({ requestBody, responseBody }: AuditDiffViewerProps) {
  const [view, setView] = useState<'diff' | 'raw'>('diff');
  const rows = useMemo(() => buildDiffRows(requestBody, responseBody), [requestBody, responseBody]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-8">
        <p className="text-[11px] text-ink-70">
          Comparing the request payload sent to the API against the response payload it returned. This is not a
          database before/after snapshot (this app doesn't re-read the entity's prior state).
        </p>
        <div className="flex shrink-0 gap-4">
          <button
            type="button"
            onClick={() => setView('diff')}
            className={cx(
              'h-[28px] border px-12 text-[11px] font-semibold uppercase tracking-label',
              view === 'diff' ? 'border-zamurrad bg-zamurrad text-paper' : 'border-line bg-paper text-ink-70',
            )}
          >
            Field diff
          </button>
          <button
            type="button"
            onClick={() => setView('raw')}
            className={cx(
              'h-[28px] border px-12 text-[11px] font-semibold uppercase tracking-label',
              view === 'raw' ? 'border-zamurrad bg-zamurrad text-paper' : 'border-line bg-paper text-ink-70',
            )}
          >
            Raw JSON
          </button>
        </div>
      </div>

      {view === 'diff' ? (
        <div className="max-h-[50vh] overflow-auto border border-line">
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 z-10 bg-nacre">
              <tr>
                <th className="whitespace-nowrap border-b border-line px-12 py-6 text-left font-semibold uppercase tracking-label text-ink-70">
                  Field
                </th>
                <th className="border-b border-line px-12 py-6 text-left font-semibold uppercase tracking-label text-ink-70">
                  Request
                </th>
                <th className="border-b border-line px-12 py-6 text-left font-semibold uppercase tracking-label text-ink-70">
                  Response
                </th>
                <th className="whitespace-nowrap border-b border-line px-12 py-6 text-left font-semibold uppercase tracking-label text-ink-70">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-12 py-24 text-center text-ink-70">
                    Both bodies are empty.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.path} className="border-b border-line align-top">
                    <td className="whitespace-nowrap px-12 py-6 font-mono text-ink">{row.path}</td>
                    <td className="max-w-[280px] break-words px-12 py-6 font-mono text-ink-70">
                      {row.requestValue ?? '—'}
                    </td>
                    <td className="max-w-[280px] break-words px-12 py-6 font-mono text-ink-70">
                      {row.responseValue ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-12 py-6">
                      <span className={cx('rounded-sm px-8 py-2 text-[10px] font-semibold uppercase tracking-label', STATUS_CLASSES[row.status])}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-semibold uppercase tracking-label text-ink-70">Request</p>
            <pre className="max-h-[50vh] overflow-auto border border-line bg-nacre p-12 text-[11px] leading-relaxed text-ink">
              {JSON.stringify(requestBody, null, 2)}
            </pre>
          </div>
          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-semibold uppercase tracking-label text-ink-70">Response</p>
            <pre className="max-h-[50vh] overflow-auto border border-line bg-nacre p-12 text-[11px] leading-relaxed text-ink">
              {JSON.stringify(responseBody, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
