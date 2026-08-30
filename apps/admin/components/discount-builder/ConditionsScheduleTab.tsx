'use client';

import { Emirate, PaymentMethod } from '@lulwah/contracts';
import type { DiscountDraft } from '../../lib/discount-draft';
import { MoneyInput } from '../product-editor/MoneyInput';
import { labelClassName } from '../product-editor/field-styles';
import { MultiCheckList } from '../product-editor/MultiCheckList';

/** plan.md §11.1: "conditions, schedule" — `DiscountConditions`
 *  (`@lulwah/contracts`' `discount.ts`) field-for-field. `customerTags` is a
 *  free-text `string[] | null` with no reference list anywhere in the API
 *  (no `customer.tags` admin endpoint exists yet — Customers is a separate,
 *  parallel workstream), so it's a comma-separated text input rather than a
 *  picker, same "no combobox primitive, keep it simple" reasoning
 *  `MultiCheckList`'s own doc comment gives for its choice of widget. */
export function ConditionsScheduleTab({ draft, onChange }: { draft: DiscountDraft; onChange: (next: DiscountDraft) => void }) {
  const c = draft.conditions;
  const setConditions = (patch: Partial<typeof c>) => onChange({ ...draft, conditions: { ...c, ...patch } });

  return (
    <div className="flex flex-col gap-24">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <MoneyInput
          label="Minimum spend (AED, optional)"
          valueFils={c.minSubtotalFils}
          nullable
          onChange={(minSubtotalFils) => setConditions({ minSubtotalFils })}
        />
        <div className="flex flex-col gap-4">
          <label htmlFor="min-quantity" className={labelClassName}>
            Minimum quantity (optional)
          </label>
          <input
            id="min-quantity"
            type="number"
            min={1}
            step={1}
            value={c.minQuantity ?? ''}
            onChange={(e) => setConditions({ minQuantity: e.target.value === '' ? null : Math.max(1, Number(e.target.value)) })}
            className="h-[40px] w-full border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
          />
        </div>
      </div>

      <label className="flex items-center gap-8 text-body-sm text-ink">
        <input
          type="checkbox"
          checked={c.firstOrderOnly}
          onChange={(e) => setConditions({ firstOrderOnly: e.target.checked })}
        />
        First-time customers only
      </label>

      <div className="flex flex-col gap-4">
        <label htmlFor="customer-tags" className={labelClassName}>
          Customer tags (optional, comma-separated)
        </label>
        <input
          id="customer-tags"
          type="text"
          placeholder="e.g. vip, wholesale"
          value={(c.customerTags ?? []).join(', ')}
          onChange={(e) => {
            const tags = e.target.value
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
            setConditions({ customerTags: tags.length > 0 ? tags : null });
          }}
          className="h-[40px] w-full border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
        />
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Emirates (optional; empty means all)</span>
          <MultiCheckList
            options={Emirate.options.map((e) => ({ value: e, label: e.replace(/_/g, ' ') }))}
            selected={c.emirates ?? []}
            onChange={(next) => setConditions({ emirates: next.length > 0 ? (next as Emirate[]) : null })}
          />
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Payment methods (optional; empty means all)</span>
          <MultiCheckList
            options={PaymentMethod.options.map((m) => ({ value: m, label: m.replace(/_/g, ' ') }))}
            selected={c.paymentMethods ?? []}
            onChange={(next) => setConditions({ paymentMethods: next.length > 0 ? (next as PaymentMethod[]) : null })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <label htmlFor="starts-at" className={labelClassName}>
            Starts (optional)
          </label>
          <input
            id="starts-at"
            type="datetime-local"
            value={c.startsAt ?? ''}
            onChange={(e) => setConditions({ startsAt: e.target.value || null })}
            className="h-[40px] w-full border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
          />
        </div>
        <div className="flex flex-col gap-4">
          <label htmlFor="ends-at" className={labelClassName}>
            Ends (optional)
          </label>
          <input
            id="ends-at"
            type="datetime-local"
            value={c.endsAt ?? ''}
            onChange={(e) => setConditions({ endsAt: e.target.value || null })}
            className="h-[40px] w-full border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
          />
        </div>
      </div>
    </div>
  );
}
