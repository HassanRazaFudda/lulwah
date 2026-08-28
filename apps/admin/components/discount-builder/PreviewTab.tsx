'use client';

import { useState } from 'react';
import type { DiscountDraft } from '../../lib/discount-draft';
import { estimateDiscountPreview } from '../../lib/discount-preview';
import { MoneyInput } from '../product-editor/MoneyInput';

/**
 * plan.md §11.1: "Live preview: 'on a sample cart of X, this discount gives
 * AED Y off.'" The real calculation (`applyDiscounts()`,
 * `apps/api/src/modules/pricing/discount-engine.ts`) runs server-only and
 * has no HTTP endpoint exposing it (confirmed by reading
 * `pricing.routes.ts` — no `/preview`/`/simulate` route exists). Rather
 * than skip this feature or silently fake it, `estimateDiscountPreview`
 * (`lib/discount-preview.ts`) is an honestly-labelled, client-side
 * best-effort approximation that only computes real numbers for the simple
 * cases (percentage/fixed_amount, applies-to-all, no exclusions, no
 * min-quantity condition) and explicitly declines — rather than guesses —
 * for anything more complex (tiered/BOGO/bundle/free-shipping, targeted
 * discounts, stacking with other discounts). See that file's own doc
 * comment for the full list of what it does and doesn't cover.
 */
export function PreviewTab({ draft }: { draft: DiscountDraft }) {
  const [sampleSubtotalFils, setSampleSubtotalFils] = useState<number | null>(50_000); // AED 500 default

  const result = estimateDiscountPreview(draft, sampleSubtotalFils ?? 0);

  return (
    <div className="flex flex-col gap-16">
      <p className="text-body-sm text-ink-70">
        This is a client-side ESTIMATE, not the real pricing engine — it only covers simple, untargeted percentage/fixed-amount
        discounts. It is not run when the discount actually applies at checkout; that always uses the real server-side
        engine.
      </p>
      <div className="max-w-[280px]">
        <MoneyInput label="Sample cart subtotal (AED)" valueFils={sampleSubtotalFils} onChange={setSampleSubtotalFils} />
      </div>
      <div className={result.supported ? 'border border-line bg-nacre p-16' : 'border border-ink-20 bg-paper p-16'}>
        <p className={result.supported ? 'text-body font-semibold text-ink' : 'text-body-sm text-ink-70'}>{result.message}</p>
      </div>
    </div>
  );
}
