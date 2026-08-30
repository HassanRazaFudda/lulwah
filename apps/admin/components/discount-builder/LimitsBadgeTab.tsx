'use client';

import { Input } from '@lulwah/ui';
import type { DiscountDraft } from '../../lib/discount-draft';
import { labelClassName } from '../product-editor/field-styles';

/** plan.md §11.1: "limits, ... badge text EN/AR". `usage.usedCount` is
 *  server-owned (see `discount-draft.ts`'s doc comment) — shown read-only
 *  here via the `usedCount` prop (only present once a discount is loaded
 *  from the server; absent for a brand-new, unsaved draft) rather than
 *  editable. */
export function LimitsBadgeTab({
  draft,
  onChange,
  usedCount,
}: {
  draft: DiscountDraft;
  onChange: (next: DiscountDraft) => void;
  usedCount?: number | undefined;
}) {
  const usage = draft.usage;
  const setUsage = (patch: Partial<typeof usage>) => onChange({ ...draft, usage: { ...usage, ...patch } });

  return (
    <div className="flex flex-col gap-24">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
        <div className="flex flex-col gap-4">
          <label htmlFor="limit-total" className={labelClassName}>
            Total usage limit (optional, blank = unlimited)
          </label>
          <input
            id="limit-total"
            type="number"
            min={1}
            step={1}
            value={usage.limitTotal ?? ''}
            onChange={(e) => setUsage({ limitTotal: e.target.value === '' ? null : Math.max(1, Number(e.target.value)) })}
            className="h-[40px] w-full border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
          />
        </div>
        <div className="flex flex-col gap-4">
          <label htmlFor="limit-per-customer" className={labelClassName}>
            Per-customer limit (optional, blank = unlimited)
          </label>
          <input
            id="limit-per-customer"
            type="number"
            min={1}
            step={1}
            value={usage.limitPerCustomer ?? ''}
            onChange={(e) => setUsage({ limitPerCustomer: e.target.value === '' ? null : Math.max(1, Number(e.target.value)) })}
            className="h-[40px] w-full border border-line bg-paper px-16 text-body-sm text-ink outline-none focus:border-zamurrad"
          />
        </div>
        {usedCount !== undefined ? (
          <div className="flex flex-col gap-4">
            <span className={labelClassName}>Used so far (read-only)</span>
            <p className="text-body-sm text-ink">
              {usedCount}
              {usage.limitTotal !== null ? ` / ${usage.limitTotal}` : ' / unlimited'}
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <Input label="Badge text (EN)" value={draft.bannerTextEn} onChange={(e) => onChange({ ...draft, bannerTextEn: e.target.value })} />
        <Input
          label="Badge text (AR)"
          dir="rtl"
          value={draft.bannerTextAr}
          onChange={(e) => onChange({ ...draft, bannerTextAr: e.target.value })}
        />
      </div>
    </div>
  );
}
