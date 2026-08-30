'use client';

import type { ProductDraft } from '../../lib/product-draft';
import { MoneyInput } from './MoneyInput';
import { labelClassName, selectClassName } from './field-styles';

/**
 * plan.md §11.1 Pricing tab: base price, compare-at, tax class. No
 * discount engine exists yet (confirmed in `docs/implemented-plan.md` —
 * P2 scope), so this deliberately does not build a stitching-add-on price
 * calculator or margin/markup tooling beyond the two real fields the
 * `AdminCreateProductInput`/`AdminUpdateProductInput` DTOs actually accept
 * for custom-stitch pricing (`stitchingPriceFils`, `stitchingLeadDays`).
 */
export function PricingTab({ draft, onChange }: { draft: ProductDraft; onChange: (next: ProductDraft) => void }) {
  return (
    <div className="flex flex-col gap-24">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
        <MoneyInput label="Base price (AED)" valueFils={draft.basePriceFils} onChange={(fils) => onChange({ ...draft, basePriceFils: fils ?? 0 })} />
        <MoneyInput
          label="Compare-at price (AED, optional)"
          valueFils={draft.compareAtPriceFils}
          nullable
          onChange={(compareAtPriceFils) => onChange({ ...draft, compareAtPriceFils })}
        />
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Tax class</span>
          <select
            className={selectClassName}
            value={draft.taxClass}
            onChange={(e) => onChange({ ...draft, taxClass: e.target.value as ProductDraft['taxClass'] })}
          >
            <option value="standard_5">Standard (5% VAT)</option>
            <option value="zero">Zero-rated</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-8 text-body-sm text-ink">
        <input
          type="checkbox"
          checked={draft.isCustomStitchAvailable}
          onChange={(e) =>
            onChange({
              ...draft,
              isCustomStitchAvailable: e.target.checked,
              ...(e.target.checked ? {} : { stitchingPriceFils: null, stitchingLeadDays: null }),
            })
          }
        />
        Custom stitching available for this product
      </label>

      {draft.isCustomStitchAvailable ? (
        <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
          <MoneyInput
            label="Custom stitching price (AED)"
            valueFils={draft.stitchingPriceFils}
            nullable
            onChange={(stitchingPriceFils) => onChange({ ...draft, stitchingPriceFils })}
          />
          <div className="flex flex-col gap-4">
            <span className={labelClassName}>Stitching lead time (days)</span>
            <input
              type="number"
              min={1}
              className={selectClassName}
              value={draft.stitchingLeadDays ?? ''}
              onChange={(e) =>
                onChange({ ...draft, stitchingLeadDays: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
