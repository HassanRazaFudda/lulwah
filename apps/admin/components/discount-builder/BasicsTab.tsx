'use client';

import { DiscountStatus } from '@lulwah/contracts';
import { Input } from '@lulwah/ui';
import type { DiscountDraft } from '../../lib/discount-draft';
import { labelClassName, selectClassName, textareaClassName } from '../product-editor/field-styles';

const STATUS_LABELS: Record<DiscountStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  active: 'Active',
  expired: 'Expired',
  disabled: 'Disabled',
};

/** plan.md §11.1 Discounts builder: "mode (automatic/code) ... stacking,
 *  priority". `code` is required by the server whenever `mode === 'code'`
 *  (`pricing.service.ts#createDiscount`'s explicit 400 check) — mirrored
 *  here as a disabled/required toggle rather than only surfacing the
 *  server's rejection after the fact, same "real client-side validation"
 *  standard `InventoryAdjustForm` already sets. */
export function BasicsTab({ draft, onChange }: { draft: DiscountDraft; onChange: (next: DiscountDraft) => void }) {
  const codeMissing = draft.mode === 'code' && draft.code !== null && draft.code.trim() === '';

  return (
    <div className="flex flex-col gap-24">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <Input label="Name" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
        <div className="flex flex-col gap-4">
          <label htmlFor="discount-status" className={labelClassName}>
            Status
          </label>
          <select
            id="discount-status"
            className={selectClassName}
            value={draft.status}
            onChange={(e) => onChange({ ...draft, status: e.target.value as DiscountStatus })}
          >
            {DiscountStatus.options.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <label htmlFor="discount-description" className={labelClassName}>
          Internal description — staff-only, never shown to customers
        </label>
        <textarea
          id="discount-description"
          className={textareaClassName}
          value={draft.internalDescription}
          onChange={(e) => onChange({ ...draft, internalDescription: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Mode</span>
          <div className="flex gap-16">
            <label className="flex items-center gap-8 text-body-sm text-ink">
              <input
                type="radio"
                name="discount-mode"
                checked={draft.mode === 'automatic'}
                onChange={() => onChange({ ...draft, mode: 'automatic', code: null })}
              />
              Automatic — applies to every eligible cart, no code needed
            </label>
            <label className="flex items-center gap-8 text-body-sm text-ink">
              <input
                type="radio"
                name="discount-mode"
                checked={draft.mode === 'code'}
                onChange={() => onChange({ ...draft, mode: 'code', code: draft.code ?? '' })}
              />
              Code — customer enters a code at checkout
            </label>
          </div>
        </div>

        {draft.mode === 'code' ? (
          <Input
            label="Code"
            value={draft.code ?? ''}
            onChange={(e) => onChange({ ...draft, code: e.target.value.toUpperCase() })}
            {...(codeMissing ? { errorMessage: 'A code is required for a code-mode discount.' } : {})}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
        <Input
          label="Priority — lower runs first"
          type="number"
          step={1}
          value={draft.priority}
          onChange={(e) => onChange({ ...draft, priority: Number(e.target.value) || 0 })}
        />
        <label className="flex items-center gap-8 text-body-sm text-ink">
          <input type="checkbox" checked={draft.stackable} onChange={(e) => onChange({ ...draft, stackable: e.target.checked })} />
          Stackable with other discounts
        </label>
        <label className="flex items-center gap-8 text-body-sm text-ink">
          <input
            type="checkbox"
            checked={draft.showOnProductCard}
            onChange={(e) => onChange({ ...draft, showOnProductCard: e.target.checked })}
          />
          Show badge on product card
        </label>
      </div>
    </div>
  );
}
