'use client';

import { DiscountAppliesTo, DiscountType } from '@lulwah/contracts';
import { Button } from '@lulwah/ui';
import type { DiscountDraft } from '../../lib/discount-draft';
import { useAdminCollectionsQuery } from '../../lib/queries/catalog-refs';
import { MoneyInput } from '../product-editor/MoneyInput';
import { labelClassName, selectClassName } from '../product-editor/field-styles';
import { ExcludePicker } from './ExcludePicker';
import { TargetPicker } from './TargetPicker';

const TYPE_LABELS: Record<DiscountType, string> = {
  percentage: 'Percentage off',
  fixed_amount: 'Fixed amount off',
  free_shipping: 'Free shipping',
  buy_x_get_y: 'Buy X, get Y',
  tiered: 'Tiered (by cart subtotal)',
  bundle: 'Bundle (flat amount off)',
};

const APPLIES_TO_LABELS: Record<DiscountAppliesTo, string> = {
  all: 'All products',
  products: 'Specific products',
  collections: 'Specific collections',
  categories: 'Specific categories',
  brands: 'Specific brands',
};

/**
 * plan.md §11.1: "type, value, targets with a product/collection picker".
 * `value`'s meaning depends entirely on `type` — `@lulwah/contracts`'
 * `discount.ts` documents it inline ("20 = 20% | fils for fixed_amount")
 * and `discount-engine.ts#computeDiscountAmount` is the authoritative
 * account of what each type actually does with it: `percentage` reads it
 * as a 0-100 percent, `fixed_amount`/`bundle` read it as fils (a money
 * input, converted at the boundary per plan.md §11.2 rule 6),
 * `free_shipping` ignores it entirely (0 shipping fee is the whole effect),
 * and `tiered`/`buy_x_get_y` ignore the top-level `value` in favour of
 * their own `tiers[]`/`buyXGetY` sub-objects — this tab shows exactly the
 * right control (or none) for whichever `type` is selected, rather than
 * always rendering a generic numeric field that would be misleading for
 * four of the six types.
 */
export function ValueTargetsTab({ draft, onChange }: { draft: DiscountDraft; onChange: (next: DiscountDraft) => void }) {
  const { data: collections } = useAdminCollectionsQuery();

  return (
    <div className="flex flex-col gap-24">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <label htmlFor="discount-type" className={labelClassName}>
            Type
          </label>
          <select
            id="discount-type"
            className={selectClassName}
            value={draft.type}
            onChange={(e) => onChange({ ...draft, type: e.target.value as DiscountType })}
          >
            {DiscountType.options.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {draft.type === 'percentage' ? (
          <div className="flex flex-col gap-4">
            <label htmlFor="discount-value-pct" className={labelClassName}>
              Value (%)
            </label>
            <input
              id="discount-value-pct"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={draft.value}
              onChange={(e) => onChange({ ...draft, value: Number(e.target.value) || 0 })}
              className={selectClassName}
            />
          </div>
        ) : null}

        {draft.type === 'fixed_amount' || draft.type === 'bundle' ? (
          <MoneyInput label="Value (AED)" valueFils={draft.value} onChange={(fils) => onChange({ ...draft, value: fils ?? 0 })} />
        ) : null}

        {draft.type === 'free_shipping' ? (
          <p className="self-end text-body-sm text-ink-70">Waives shipping, so no value field is needed.</p>
        ) : null}
      </div>

      {draft.type === 'tiered' ? <TiersEditor draft={draft} onChange={onChange} /> : null}
      {draft.type === 'buy_x_get_y' ? (
        <BuyXGetYEditor draft={draft} onChange={onChange} collections={collections ?? []} />
      ) : null}

      <div className="flex flex-col gap-4">
        <label htmlFor="discount-applies-to" className={labelClassName}>
          Applies to
        </label>
        <select
          id="discount-applies-to"
          className={selectClassName}
          value={draft.appliesTo}
          onChange={(e) => onChange({ ...draft, appliesTo: e.target.value as DiscountAppliesTo, targetIds: [] })}
        >
          {DiscountAppliesTo.options.map((option) => (
            <option key={option} value={option}>
              {APPLIES_TO_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-4">
        <span className={labelClassName}>Targets</span>
        <TargetPicker appliesTo={draft.appliesTo} selected={draft.targetIds} onChange={(targetIds) => onChange({ ...draft, targetIds })} />
      </div>

      <div className="flex flex-col gap-4">
        <span className={labelClassName}>Exclusions (optional)</span>
        <ExcludePicker selected={draft.excludeIds} onChange={(excludeIds) => onChange({ ...draft, excludeIds })} />
      </div>
    </div>
  );
}

function TiersEditor({ draft, onChange }: { draft: DiscountDraft; onChange: (next: DiscountDraft) => void }) {
  const tiers = draft.tiers ?? [];

  const setTiers = (next: typeof tiers) => onChange({ ...draft, tiers: next.length > 0 ? next : null });

  return (
    <div className="flex flex-col gap-8 border border-line p-16">
      <span className={labelClassName}>
        Tiers: the highest tier whose minimum spend the cart meets applies (plan.md §7.12 shape; the engine's own reading, see
        `discount-engine.ts`)
      </span>
      {tiers.map((tier, index) => (
        <div key={index} className="flex flex-wrap items-end gap-8">
          <MoneyInput
            label="Min spend (AED)"
            valueFils={tier.minSubtotalFils}
            onChange={(fils) => setTiers(tiers.map((t, i) => (i === index ? { ...t, minSubtotalFils: fils ?? 0 } : t)))}
          />
          <div className="flex flex-col gap-4">
            <span className={labelClassName}>Value (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={tier.value}
              onChange={(e) => setTiers(tiers.map((t, i) => (i === index ? { ...t, value: Number(e.target.value) || 0 } : t)))}
              className={selectClassName}
            />
          </div>
          <Button type="button" variant="secondary" onClick={() => setTiers(tiers.filter((_, i) => i !== index))}>
            Remove
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" variant="secondary" onClick={() => setTiers([...tiers, { minSubtotalFils: 0, value: 0 }])}>
          Add tier
        </Button>
      </div>
    </div>
  );
}

function BuyXGetYEditor({
  draft,
  onChange,
  collections,
}: {
  draft: DiscountDraft;
  onChange: (next: DiscountDraft) => void;
  collections: { id: string; name: string }[];
}) {
  const bxgy = draft.buyXGetY ?? { buyQty: 1, getQty: 1, appliesToCollectionId: null, discountPercent: 100 };
  const setBxgy = (next: typeof bxgy) => onChange({ ...draft, buyXGetY: next });

  return (
    <div className="grid grid-cols-1 gap-16 border border-line p-16 md:grid-cols-4">
      <div className="flex flex-col gap-4">
        <span className={labelClassName}>Buy qty</span>
        <input
          type="number"
          min={1}
          step={1}
          value={bxgy.buyQty}
          onChange={(e) => setBxgy({ ...bxgy, buyQty: Math.max(1, Number(e.target.value) || 1) })}
          className={selectClassName}
        />
      </div>
      <div className="flex flex-col gap-4">
        <span className={labelClassName}>Get qty</span>
        <input
          type="number"
          min={1}
          step={1}
          value={bxgy.getQty}
          onChange={(e) => setBxgy({ ...bxgy, getQty: Math.max(1, Number(e.target.value) || 1) })}
          className={selectClassName}
        />
      </div>
      <div className="flex flex-col gap-4">
        <span className={labelClassName}>Discount on the "get" items (%)</span>
        <input
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={bxgy.discountPercent}
          onChange={(e) => setBxgy({ ...bxgy, discountPercent: Number(e.target.value) || 0 })}
          className={selectClassName}
        />
      </div>
      <div className="flex flex-col gap-4">
        <span className={labelClassName}>Scoped to collection (optional)</span>
        <select
          className={selectClassName}
          value={bxgy.appliesToCollectionId ?? ''}
          onChange={(e) => setBxgy({ ...bxgy, appliesToCollectionId: e.target.value || null })}
        >
          <option value="">Any eligible product</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
