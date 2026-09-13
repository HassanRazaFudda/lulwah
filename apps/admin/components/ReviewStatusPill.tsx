import type { ReviewStatus } from '@lulwah/contracts';
import { cx } from '@lulwah/ui';

/** `DiscountStatusPill`'s sibling for `ReviewStatus` (`pending | approved |
 *  rejected`) — same dense pill treatment, locked tokens only (plan.md
 *  §13.3), kept as its own component for the same reason
 *  `DiscountStatusPill.tsx`'s own doc comment gives: each status domain is
 *  small enough that a sibling is simpler than a shared generic. */
const STATUS_STYLES: Record<ReviewStatus, string> = {
  pending: 'border-gold/50 bg-gold/20 text-gold-dark',
  approved: 'border-success/40 bg-success/12 text-success',
  rejected: 'border-danger/30 bg-danger/10 text-danger',
};

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function ReviewStatusPill({ status, size = 'md' }: { status: ReviewStatus; size?: 'sm' | 'md' }) {
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
