import type { OrderStatus } from '@lulwah/contracts';
import { cx } from '@lulwah/ui';
import { ORDER_STATUS_META } from '../lib/order-status';

export interface StatusFlagPillProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
}

/**
 * plan.md §8.7.4 ("current flag as a pill") and §11.1's Orders table
 * ("status flag pill") — the visual half of the state machine in
 * `lib/order-status.ts`. Every colour is one of the locked tokens from
 * `@lulwah/tokens` (plan.md §13.3); no new hex values are introduced for
 * the admin console. The two "happy terminal" states (`delivered`) and the
 * hardest-failure states (`failed`) get a solid fill instead of a tint so
 * they read as heavier/final at a glance in a dense table — everything
 * else is a light tint, keeping the console's neutral-plus-one-accent rule
 * (plan.md §11) intact everywhere except this deliberately multi-coloured
 * status indicator.
 */
const STATUS_STYLES: Record<OrderStatus, string> = {
  pending_payment: 'border-warning/40 bg-warning/12 text-warning',
  confirmed: 'border-success/40 bg-success/12 text-success',
  processing: 'border-mukaish/50 bg-mukaish/15 text-ink-70',
  stitching: 'border-gold-dark/40 bg-gold-dark/15 text-gold-dark',
  ready_to_ship: 'border-gold/50 bg-gold/20 text-gold-dark',
  shipped: 'border-zamurrad/40 bg-zamurrad/12 text-zamurrad',
  out_for_delivery: 'border-zamurrad-deep/40 bg-zamurrad-deep/12 text-zamurrad-deep',
  delivered: 'border-success bg-success text-paper',
  cancelled: 'border-danger/40 bg-danger/12 text-danger',
  returned: 'border-garnet/40 bg-garnet/12 text-garnet',
  refunded: 'border-mukaish/60 bg-mukaish/30 text-ink-70',
  failed: 'border-danger bg-danger text-paper',
};

export function StatusFlagPill({ status, size = 'md' }: StatusFlagPillProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center whitespace-nowrap rounded-sm border font-semibold uppercase tracking-label',
        size === 'sm' ? 'h-16 px-8 text-[10px]' : 'h-24 px-12 text-label',
        STATUS_STYLES[status],
      )}
    >
      {ORDER_STATUS_META[status].labelEn}
    </span>
  );
}
