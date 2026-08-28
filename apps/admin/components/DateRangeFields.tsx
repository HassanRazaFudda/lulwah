'use client';

const FIELD_CLASSES =
  'h-[40px] border border-line bg-paper px-12 text-body-sm text-ink outline-none focus:border-zamurrad';

export interface DateRangeFieldsProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}

/** Shared `From`/`To` date inputs — used by the Reports screen's date-range
 *  filter (every report except Inventory) and the Audit log's `dateFrom`/
 *  `dateTo` filter (`AdminListAuditLogQuery`, `audit.dto.ts`). Both accept
 *  the same "omitted = unbounded" semantics server-side, so this has no
 *  default/required state of its own — an empty string always means "no
 *  bound," never a hidden default date. */
export function DateRangeFields({ dateFrom, dateTo, onDateFromChange, onDateToChange }: DateRangeFieldsProps) {
  return (
    <>
      <label className="flex items-center gap-8 text-body-sm text-ink-70">
        From
        <input
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
          className={FIELD_CLASSES}
        />
      </label>
      <label className="flex items-center gap-8 text-body-sm text-ink-70">
        To
        <input
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
          className={FIELD_CLASSES}
        />
      </label>
    </>
  );
}
