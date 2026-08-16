'use client';

import { Minus, Plus } from 'lucide-react';

export interface QuantityStepperProps {
  quantity: number;
  onChange: (quantity: number) => void;
  min?: number;
  max?: number;
  label: string;
}

/** Shared +/- quantity control — PDP (§15.4 item 9) and cart line items (§15.5). */
export function QuantityStepper({ quantity, onChange, min = 1, max = 10, label }: QuantityStepperProps) {
  return (
    <div className="inline-flex h-[52px] items-center border border-ink-20" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, quantity - 1))}
        disabled={quantity <= min}
        aria-label="Decrease quantity"
        className="inline-flex h-full w-40 items-center justify-center text-ink transition-colors duration-fast ease-out hover:bg-nacre disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Minus size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <span className="w-40 text-center font-body text-body font-medium tabular-nums text-ink" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, quantity + 1))}
        disabled={quantity >= max}
        aria-label="Increase quantity"
        className="inline-flex h-full w-40 items-center justify-center text-ink transition-colors duration-fast ease-out hover:bg-nacre disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}
