'use client';

import { useState } from 'react';
import { StockMovementType } from '@lulwah/contracts';
import { Button } from '@lulwah/ui';
import { useAdjustStockMutation } from '../lib/queries/inventory';

export interface InventoryAdjustFormProps {
  variantId: string;
  currentOnHand: number;
  onAdjusted?: () => void;
}

/**
 * `POST /admin/inventory/:variantId/adjust` — plan.md §9.7. `AdjustStockInput`
 * (`@lulwah/contracts`' `inventory.ts`) requires a non-zero `quantity` and a
 * non-empty `reason`; the API 400s otherwise ("A reason is required for
 * every stock adjustment."). This form enforces both client-side — disabled
 * submit, inline messages — rather than only surfacing the server's
 * rejection after the fact, per the task brief's explicit instruction to
 * treat the mandatory-reason rule as real client-side validation.
 *
 * Shared by the standalone Inventory detail page and the product editor's
 * Inventory tab — both adjust the exact same endpoint for the exact same
 * reason (one variant, one on-hand count, one audit trail).
 */
export function InventoryAdjustForm({ variantId, currentOnHand, onAdjusted }: InventoryAdjustFormProps) {
  const [quantity, setQuantity] = useState('');
  const [type, setType] = useState<StockMovementType>('adjustment');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const adjustStock = useAdjustStockMutation();

  const parsedQuantity = Number(quantity);
  const quantityError = quantity.trim() === '' ? 'Enter a quantity.' : !Number.isInteger(parsedQuantity) ? 'Must be a whole number.' : parsedQuantity === 0 ? 'Quantity cannot be zero.' : null;
  const reasonError = reason.trim() === '' ? 'A reason is required for every stock adjustment.' : null;
  const wouldGoNegative = quantityError === null && currentOnHand + parsedQuantity < 0;

  const canSubmit = quantityError === null && reasonError === null && !wouldGoNegative && !adjustStock.isPending;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    adjustStock.mutate(
      { variantId, quantity: parsedQuantity, type, reason: reason.trim() },
      {
        onSuccess: () => {
          setQuantity('');
          setReason('');
          setTouched(false);
          onAdjusted?.();
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-12">
      <div className="flex flex-wrap gap-8">
        <div className="flex flex-col gap-4">
          <label htmlFor={`qty-${variantId}`} className="text-label uppercase tracking-label text-ink-70">
            Quantity (+/-)
          </label>
          <input
            id={`qty-${variantId}`}
            type="number"
            step={1}
            placeholder="e.g. 10 or -3"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="h-[40px] w-[140px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
          />
          {touched && quantityError ? <p className="text-body-sm text-danger">{quantityError}</p> : null}
        </div>

        <div className="flex flex-col gap-4">
          <label htmlFor={`type-${variantId}`} className="text-label uppercase tracking-label text-ink-70">
            Movement type
          </label>
          <select
            id={`type-${variantId}`}
            value={type}
            onChange={(event) => setType(event.target.value as StockMovementType)}
            className="h-[40px] border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
          >
            {StockMovementType.options.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <label htmlFor={`reason-${variantId}`} className="text-label uppercase tracking-label text-ink-70">
          Reason (required)
        </label>
        <textarea
          id={`reason-${variantId}`}
          placeholder="e.g. Warehouse recount, damaged in transit, return receipt…"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-h-[64px] border border-line bg-paper p-12 text-body-sm outline-none focus:border-zamurrad"
        />
        {touched && reasonError ? <p className="text-body-sm text-danger">{reasonError}</p> : null}
      </div>

      {touched && wouldGoNegative ? (
        <p className="text-body-sm text-danger">
          This would take on-hand stock below zero (currently {currentOnHand}).
        </p>
      ) : null}
      {adjustStock.isError ? <p className="text-body-sm text-danger">{adjustStock.error.message}</p> : null}

      <div>
        <Button type="submit" disabled={touched && !canSubmit}>
          {adjustStock.isPending ? 'Applying…' : 'Apply adjustment'}
        </Button>
      </div>
    </form>
  );
}
