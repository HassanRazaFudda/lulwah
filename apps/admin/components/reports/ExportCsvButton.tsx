'use client';

import { Button } from '@lulwah/ui';
import { isForbiddenError } from '../../lib/api-client';
import { useExportReportCsv } from '../../lib/queries/reports';

export interface ExportCsvButtonProps {
  /** Full path including `?format=csv&...` — built by the caller from
   *  whatever query params that report already sent for its JSON view, so
   *  the export always reflects the same filters currently on screen. */
  path: string;
  fallbackFilename: string;
}

/**
 * `?format=csv` requires `reports.write` on top of the `reports.read` the
 * rest of the screen needs (`report.policy.ts`'s doc comment) — a real,
 * narrower permission most roles that can *view* reports don't hold
 * (`identity.policy.ts`'s `ROLE_PERMISSIONS`: only `super_admin`/`finance`
 * get `reports.write`). A 403 here is a normal, expected outcome for a
 * `manager`/`catalog`/`order_ops`/`content` admin, so it's surfaced as an
 * inline message, not thrown at the page level.
 */
export function ExportCsvButton({ path, fallbackFilename }: ExportCsvButtonProps) {
  const exportCsv = useExportReportCsv();

  return (
    <div className="flex flex-col items-end gap-4">
      <Button
        type="button"
        variant="secondary"
        className="h-[40px] px-16 text-[11px]"
        disabled={exportCsv.isPending}
        onClick={() => exportCsv.mutate({ path, fallbackFilename })}
      >
        {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
      </Button>
      {exportCsv.isError ? (
        <p className="max-w-[240px] text-right text-[11px] text-danger">
          {isForbiddenError(exportCsv.error)
            ? "Export requires the reports.write permission; you can view this report but not export it."
            : exportCsv.error instanceof Error
              ? exportCsv.error.message
              : 'Export failed.'}
        </p>
      ) : null}
    </div>
  );
}
