import { forwardRef, useId } from 'react';
import type { SelectHTMLAttributes } from 'react';

/**
 * A `<select>` styled to match `@lulwah/ui`'s `Input` (nacre fill, bottom
 * rule) — `@lulwah/ui` ships `Button`/`Input` only, no `Select` primitive
 * yet, so the emirate dropdown (§7.2, §15.6) needs this one-off rather
 * than reaching for shadcn.
 */
export interface LabeledSelectOption {
  value: string;
  label: string;
}

export interface LabeledSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: LabeledSelectOption[];
  // `| undefined` explicit — callers forward `errors.field?.message` (RHF), already typed `string | undefined`.
  errorMessage?: string | undefined;
}

export const LabeledSelect = forwardRef<HTMLSelectElement, LabeledSelectProps>(function LabeledSelect(
  { label, options, errorMessage, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const isInvalid = Boolean(errorMessage);

  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={selectId} className="font-body text-label font-semibold tracking-label text-ink-70 uppercase">
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={isInvalid || undefined}
        aria-describedby={isInvalid ? `${selectId}-error` : undefined}
        className={`h-[52px] w-full appearance-none border-0 border-b bg-nacre px-16 font-body text-body text-ink outline-none transition-colors duration-base ease-out focus:border-b-2 focus:border-zamurrad ${isInvalid ? 'border-danger' : 'border-ink-20'} ${className ?? ''}`}
        {...props}
      >
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {errorMessage ? (
        <p id={`${selectId}-error`} role="alert" className="font-body text-body-sm text-danger">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
});
