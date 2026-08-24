import type { ProductStatus } from '@lulwah/contracts';
import { cx } from '@lulwah/ui';

export interface ProductStatusPillProps {
  status: ProductStatus;
  size?: 'sm' | 'md';
}

/**
 * The Products-table/editor equivalent of `StatusFlagPill` — same dense
 * pill treatment (locked tokens only, plan.md §13.3), but for
 * `ProductStatus` (`draft | scheduled | active | archived`) rather than
 * `OrderStatus`. Kept as its own component rather than widening
 * `StatusFlagPill` to a generic: that component's `STATUS_STYLES` map and
 * label lookup are typed exactly to `OrderStatus`'s twelve states, and
 * every other admin status domain (this one included) is small enough that
 * a sibling component is simpler than threading a generic through it.
 */
const STATUS_STYLES: Record<ProductStatus, string> = {
  draft: 'border-ink-20 bg-nacre text-ink-70',
  scheduled: 'border-gold/50 bg-gold/20 text-gold-dark',
  active: 'border-success/40 bg-success/12 text-success',
  archived: 'border-mukaish/50 bg-mukaish/20 text-ink-70',
};

const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  active: 'Active',
  archived: 'Archived',
};

export function ProductStatusPill({ status, size = 'md' }: ProductStatusPillProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center whitespace-nowrap rounded-sm border font-semibold uppercase tracking-label',
        size === 'sm' ? 'h-16 px-8 text-[10px]' : 'h-24 px-12 text-label',
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
