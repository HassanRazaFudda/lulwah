import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cx } from './cx.js';

/**
 * Input — plan.md §13.6. `--nacre` fill, no border, a 1px `--ink 20%`
 * bottom rule that animates to full-width `--zamurrad` on focus. The
 * floating label is built on Radix's `Label` primitive (correct
 * `for`/`id` wiring, click-to-focus) rather than a plain `<label>` — no
 * shadcn skin, just Radix behaviour with our own styling.
 *
 * `placeholder` is deliberately **not** an accepted prop (`Omit` below,
 * not just documented) — the floating-label CSS trick depends on the
 * real DOM `placeholder` being the literal single space this component
 * sets internally (`:placeholder-shown` is how it knows whether to float
 * the label at rest or shrink it to the top corner). A real `placeholder`
 * string overrides that space via the trailing `{...props}` spread and
 * silently breaks the shrink behavior — found live: two real call sites
 * had done exactly this, rendering their example text and the floating
 * label superimposed on top of each other at rest. `hint`, below, is the
 * fix and the intended way to show example/format text: rendered once,
 * as real static text under the field, not fighting the label for the
 * same pixels.
 */
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  label: string;
  errorMessage?: string;
  /** Example/format text shown below the field (e.g. "e.g. LF-260825-0001") — not a native `placeholder`, see this file's doc comment on why. */
  hint?: string;
}

const INPUT_CLASSES = cx(
  'peer h-[52px] w-full appearance-none rounded-none border-0 border-b border-ink-20 bg-nacre px-16 pt-16',
  'text-body text-ink outline-none transition-colors duration-base ease-out',
  'focus:border-b-2 focus:border-zamurrad',
);

const LABEL_CLASSES = cx(
  'pointer-events-none absolute left-16 top-1/2 -translate-y-1/2 text-body text-mukaish',
  'transition-all duration-base ease-out',
  'peer-focus:top-8 peer-focus:translate-y-0 peer-focus:text-label peer-focus:uppercase peer-focus:tracking-label peer-focus:text-zamurrad',
  'peer-[:not(:placeholder-shown)]:top-8 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-label peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-label',
);

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, errorMessage, hint, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const isInvalid = Boolean(errorMessage);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          placeholder=" "
          className={cx(INPUT_CLASSES, isInvalid && 'border-danger focus:border-danger', className)}
          aria-invalid={isInvalid || undefined}
          aria-describedby={isInvalid ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        <LabelPrimitive.Root htmlFor={inputId} className={LABEL_CLASSES}>
          {label}
        </LabelPrimitive.Root>
      </div>
      {errorMessage ? (
        <p id={`${inputId}-error`} role="alert" className="text-body-sm text-danger">
          {errorMessage}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-body-sm text-mukaish">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
