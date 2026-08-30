'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@lulwah/ui';
import { InventoryAdjustForm } from '../InventoryAdjustForm';
import type { AdminVariantWithStock } from '../../lib/queries/products';

/**
 * plan.md §11.1 Inventory tab: per-variant on-hand/threshold/backorder,
 * adjusted through the inventory module's mandatory-reason endpoint. Only
 * `onHand` (via `POST /admin/inventory/:variantId/adjust`) is actually
 * writable in this phase — `lowStockThreshold`/`allowBackorder` have no
 * update endpoint at all (`inventory.dto.ts`'s `AdjustStockInput` is only
 * `{ quantity, type, reason }`; they're only ever set at
 * `InventoryItem` creation, defaulting to 3 / false — see
 * `inventory-item.model.ts`). Rather than build a threshold/backorder
 * editor with nothing behind it, those two render read-only here, matching
 * the brief's "don't build UI for endpoints that don't exist" instruction
 * applied to inventory the same way it's applied to discounts/pricing.
 */
export function InventoryTab({ variants }: { variants: AdminVariantWithStock[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (variants.length === 0) {
    return <p className="text-body-sm text-ink-70">No variants yet. Add some on the Variants tab first.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {variants.map((variant) => (
        <div key={variant.id} className="flex flex-col gap-12 border border-line bg-paper p-12">
          <div className="flex flex-wrap items-center justify-between gap-8">
            <div className="text-body-sm text-ink">
              <span className="font-semibold">{variant.sku}</span>
              {' · '}
              {[variant.options.size, variant.options.color].filter(Boolean).join(' / ') || 'Base variant'}
            </div>
            <div className="flex items-center gap-16 text-body-sm text-ink-70">
              <span>
                On hand: <strong className="text-ink">{variant.onHand}</strong>
              </span>
              <span>
                Available: <strong className="text-ink">{variant.available}</strong>
              </span>
              <span>Backorder: {variant.allowBackorder ? 'Allowed' : 'Not allowed'}</span>
              <Link href={`/inventory/${variant.id}`} className="text-zamurrad hover:underline">
                Movement history
              </Link>
              <Button type="button" variant="tertiary" onClick={() => setExpandedId(expandedId === variant.id ? null : variant.id)}>
                {expandedId === variant.id ? 'Cancel' : 'Adjust stock'}
              </Button>
            </div>
          </div>
          {expandedId === variant.id ? (
            <InventoryAdjustForm
              variantId={variant.id}
              currentOnHand={variant.onHand}
              onAdjusted={() => setExpandedId(null)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
