import type { DiscountStatus } from '@lulwah/contracts';
import { cx } from '@lulwah/ui';

/** `ProductStatusPill`'s sibling for `DiscountStatus` (`draft | active |
 *  scheduled | expired | disabled`) — same dense pill treatment, locked
 *  tokens only (plan.md §13.3), kept as its own component for the same
 *  reason `ProductStatusPill`'s own doc comment gives (each status domain
 *  is small enough that a sibling is simpler than a shared generic). */
const STATUS_STYLES: Record<DiscountStatus, string> = {
  draft: 'border-ink-20 bg-nacre text-ink-70',
  scheduled: 'border-gold/50 bg-gold/20 text-gold-dark',
  active: 'border-success/40 bg-success/12 text-success',
  expired: 'border-mukaish/50 bg-mukaish/20 text-ink-70',
  disabled: 'border-danger/30 bg-danger/10 text-danger',
};

const STATUS_LABELS: Record<DiscountStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  active: 'Active',
  expired: 'Expired',
  disabled: 'Disabled',
};

export function DiscountStatusPill({ status, size = 'md' }: { status: DiscountStatus; size?: 'sm' | 'md' }) {
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
