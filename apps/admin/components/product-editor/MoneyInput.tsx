'use client';

import { Input } from '@lulwah/ui';

/** An AED-denominated number input backed by an integer fils value —
 *  `@lulwah/contracts`' `Fils` is always an integer (1 AED = 100 fils,
 *  `packages/contracts/src/money.ts`), and plan.md §8.1 is explicit that a
 *  client must never hand the API a float price, so the fils↔AED
 *  conversion happens once, here, rather than being re-derived at every
 *  call site that touches a price field. */
export function MoneyInput({
  label,
  valueFils,
  onChange,
  nullable = false,
}: {
  label: string;
  valueFils: number | null;
  onChange: (fils: number | null) => void;
  nullable?: boolean;
}) {
  const displayValue = valueFils === null ? '' : (valueFils / 100).toFixed(2);

  return (
    <Input
      label={label}
      type="number"
      min={0}
      step={0.01}
      value={displayValue}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange(nullable ? null : 0);
          return;
        }
        const aed = Number(raw);
        if (Number.isFinite(aed)) onChange(Math.round(aed * 100));
      }}
    />
  );
}
