'use client';

import type { ReactNode } from 'react';
import { DateRangeFields } from '../DateRangeFields';

const FIELD_CLASSES =
  'h-[40px] border border-line bg-paper px-12 text-body-sm text-ink outline-none focus:border-zamurrad';

// Re-exported so existing report panel imports (`from './ReportToolbar'`)
// don't all need touching now that the fields moved to a shared location
// (`components/DateRangeFields.tsx`) for the Audit log screen to reuse too.
export { DateRangeFields };
export type { DateRangeFieldsProps } from '../DateRangeFields';

export interface LimitSelectProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  options?: readonly number[];
}

/** A real, verified query param (`*ReportQuery.limit`, `report.dto.ts`) —
 *  not a client-side truncation of a larger fetched set. */
export function LimitSelect({ label, value, onChange, options = [10, 20, 50, 100] }: LimitSelectProps) {
  return (
    <label className="flex items-center gap-8 text-body-sm text-ink-70">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={FIELD_CLASSES}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface ReportToolbarProps {
  children: ReactNode;
}

export function ReportToolbar({ children }: ReportToolbarProps) {
  return <div className="flex flex-wrap items-end justify-between gap-16">{children}</div>;
}

export interface ReportToolbarFieldsProps {
  children: ReactNode;
}

export function ReportToolbarFields({ children }: ReportToolbarFieldsProps) {
  return <div className="flex flex-wrap items-center gap-8">{children}</div>;
}
