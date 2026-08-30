'use client';

import { ProductBadge, ProductStatus } from '@lulwah/contracts';
import type { ProductDraft } from '../../lib/product-draft';
import { MultiCheckList } from './MultiCheckList';
import { labelClassName, selectClassName } from './field-styles';

const BADGE_OPTIONS = ProductBadge.options.map((b) => ({ value: b, label: b.replace(/_/g, ' ') }));

/** plan.md §11.1 Publishing tab: status, `publishAt` scheduler, featured,
 *  badges. `isNewIn`/`isExclusive` are additional merchandising flags on
 *  `Product` (plan.md §7.5) grouped here alongside `isFeatured` since all
 *  three are the same kind of toggle. */
export function PublishingTab({ draft, onChange }: { draft: ProductDraft; onChange: (next: ProductDraft) => void }) {
  return (
    <div className="flex flex-col gap-24">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Status</span>
          <select
            className={selectClassName}
            value={draft.status}
            onChange={(e) => onChange({ ...draft, status: e.target.value as ProductStatus })}
          >
            {ProductStatus.options.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Publish at (optional; used when status is "scheduled")</span>
          <input
            type="datetime-local"
            className={selectClassName}
            value={draft.publishAt ?? ''}
            onChange={(e) => onChange({ ...draft, publishAt: e.target.value || null })}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-16">
        <label className="flex items-center gap-8 text-body-sm text-ink">
          <input type="checkbox" checked={draft.isFeatured} onChange={(e) => onChange({ ...draft, isFeatured: e.target.checked })} />
          Featured
        </label>
        <label className="flex items-center gap-8 text-body-sm text-ink">
          <input type="checkbox" checked={draft.isNewIn} onChange={(e) => onChange({ ...draft, isNewIn: e.target.checked })} />
          New in
        </label>
        <label className="flex items-center gap-8 text-body-sm text-ink">
          <input type="checkbox" checked={draft.isExclusive} onChange={(e) => onChange({ ...draft, isExclusive: e.target.checked })} />
          Exclusive
        </label>
      </div>

      <div className="flex flex-col gap-4">
        <span className={labelClassName}>Badges</span>
        <MultiCheckList
          options={BADGE_OPTIONS}
          selected={draft.badges}
          onChange={(badges) => onChange({ ...draft, badges: badges as typeof draft.badges })}
        />
      </div>
    </div>
  );
}
