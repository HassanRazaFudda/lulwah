'use client';

import { useState } from 'react';
import type { OrderStatus } from '@lulwah/contracts';
import { Button } from '@lulwah/ui';
import { getValidNextStatuses, ORDER_STATUS_META } from '../lib/order-status';

export interface StatusTransitionDropdownProps {
  currentStatus: OrderStatus;
  onApply: (nextStatus: OrderStatus) => void;
  disabled?: boolean;
}

/**
 * The headline admin control — plan.md §8.7.4: "A single status control in
 * the order detail header: current flag as a pill, a dropdown showing only
 * legally valid next states (invalid ones are not rendered at all —
 * impossible to make a mistake)."
 *
 * Every `<option>` comes straight from `getValidNextStatuses(currentStatus)`
 * — there is no branch here that could accidentally list an illegal
 * transition, because illegal ones are never in the array to begin with.
 * `refunded` (the one fully terminal state) has zero valid next states, so
 * this renders a plain "no further transitions" message instead of an
 * empty, clickable-looking dropdown.
 */
export function StatusTransitionDropdown({ currentStatus, onApply, disabled }: StatusTransitionDropdownProps) {
  const validNextStatuses = getValidNextStatuses(currentStatus);
  const [selected, setSelected] = useState<OrderStatus | ''>('');

  if (validNextStatuses.length === 0) {
    return <p className="text-body-sm text-ink-70">Terminal status — no further transitions.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-8">
      <select
        aria-label="Change order status to"
        className="h-[52px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        value={selected}
        disabled={disabled}
        onChange={(event) => setSelected(event.target.value as OrderStatus | '')}
      >
        <option value="">Change status to…</option>
        {validNextStatuses.map((status) => (
          <option key={status} value={status}>
            {ORDER_STATUS_META[status].labelEn}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || selected === ''}
        onClick={() => {
          if (selected !== '') {
            onApply(selected);
            setSelected('');
          }
        }}
      >
        Apply
      </Button>
    </div>
  );
}
