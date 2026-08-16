import type { OrderStatusHistoryEntry } from '@lulwah/contracts';
import { formatDateTime } from '@lulwah/utils';
import { ORDER_STATUS_META } from '../lib/order-status';

export interface OrderStatusHistoryProps {
  history: OrderStatusHistoryEntry[];
}

/**
 * plan.md §8.7.4: "Every change appends to `statusHistory` with actor,
 * timestamp, note, and whether the customer was notified. This history is
 * immutable." Rendered oldest-first as a simple audit list — the animated
 * vertical timeline with the gold shimmer (§8.7.5) is the *customer-facing*
 * tracking page, a storefront concern, not this admin audit view.
 */
export function OrderStatusHistory({ history }: OrderStatusHistoryProps) {
  if (history.length === 0) {
    return <p className="text-body-sm text-ink-70">No status changes yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-12">
      {history.map((entry, index) => (
        <li key={`${entry.to}-${entry.at.toISOString()}-${index}`} className="border-l-2 border-line pl-12">
          <p className="text-body-sm font-semibold text-ink">
            {entry.from ? `${ORDER_STATUS_META[entry.from].labelEn} → ` : ''}
            {ORDER_STATUS_META[entry.to].labelEn}
          </p>
          <p className="mt-4 text-body-sm text-ink-70">
            {formatDateTime(entry.at, 'en')} · {entry.byUserId === 'system' ? 'System' : `Staff (${entry.byUserId})`} ·{' '}
            {entry.notifiedCustomer ? 'Customer notified' : 'Customer not notified'}
          </p>
          {entry.note ? <p className="mt-4 text-body-sm text-ink-70">"{entry.note}"</p> : null}
        </li>
      ))}
    </ol>
  );
}
