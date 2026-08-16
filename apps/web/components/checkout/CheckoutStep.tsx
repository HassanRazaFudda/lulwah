'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cx } from '@lulwah/ui';

/**
 * plan.md §15.6: "Single page, three collapsible steps." A completed,
 * inactive step shows its `summary` line collapsed; the active step shows
 * its full content. `isComplete` unlocks the step (matches spec's implicit
 * requirement that Delivery can't be reached before Contact is valid).
 */
export interface CheckoutStepProps {
  index: number;
  title: string;
  // `| undefined` explicit — the caller passes `watch('email')` etc.
  // straight through, which is already typed `string | undefined`.
  summary?: string | undefined;
  isActive: boolean;
  isComplete: boolean;
  isLocked: boolean;
  onActivate: () => void;
  children: ReactNode;
}

export function CheckoutStep({ index, title, summary, isActive, isComplete, isLocked, onActivate, children }: CheckoutStepProps) {
  return (
    <section className="border border-line">
      <button
        type="button"
        onClick={onActivate}
        disabled={isLocked}
        aria-expanded={isActive}
        className={cx(
          'flex w-full items-center justify-between gap-16 px-24 py-16 text-start',
          isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        )}
      >
        <span className="flex items-center gap-16">
          <span
            className={cx(
              'inline-flex size-24 shrink-0 items-center justify-center border font-body text-body-sm',
              isComplete ? 'border-zamurrad bg-zamurrad text-paper' : 'border-ink-20 text-ink',
            )}
          >
            {isComplete ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : index}
          </span>
          <span className="font-body text-body font-medium text-ink">{title}</span>
        </span>
        {!isActive && summary ? <span className="font-body text-body-sm text-mukaish">{summary}</span> : null}
      </button>
      {isActive ? <div className="border-t border-line px-24 py-24">{children}</div> : null}
    </section>
  );
}
