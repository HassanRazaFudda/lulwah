import type { OrderRefund } from '@lulwah/contracts';
import { formatDateTime, formatMoney } from '@lulwah/utils';

export interface OrderRefundsProps {
  refunds: OrderRefund[];
}

const STATUS_LABEL: Record<OrderRefund['status'], string> = {
  pending: 'Pending',
  completed: 'Completed',
  failed: 'Failed',
};

const STATUS_CLASS: Record<OrderRefund['status'], string> = {
  pending: 'text-ink-70',
  completed: 'text-zamurrad',
  failed: 'text-danger',
};

/**
 * Refund audit trail — plan.md §8.8. `order.service.ts#refundOrder` appends
 * one `OrderRefund` per attempt, including a `failed` one (the immutable
 * "append, never edit" convention `OrderStatusHistory` already establishes
 * for status changes), so this renders every entry rather than filtering
 * down to only the successful ones — a failed attempt is real history a
 * staff member reviewing this order should be able to see. Oldest-first,
 * same convention as `OrderStatusHistory`/`OrderInternalNotes`.
 */
export function OrderRefunds({ refunds }: OrderRefundsProps) {
  if (refunds.length === 0) {
    return <p className="text-body-sm text-ink-70">No refunds issued.</p>;
  }

  return (
    <ul className="flex flex-col gap-12">
      {refunds.map((refund, index) => (
        <li key={refund.id === 'optimistic' ? `optimistic-${index}` : refund.id} className="border-l-2 border-line pl-12">
          <p className="text-body-sm font-semibold text-ink">
            {formatMoney(refund.amountFils, 'en')}{' '}
            <span className={`font-normal ${STATUS_CLASS[refund.status]}`}>· {STATUS_LABEL[refund.status]}</span>
          </p>
          <p className="mt-4 text-body-sm text-ink-70">
            {formatDateTime(refund.at, 'en')} · Staff ({refund.byUserId})
            {refund.gatewayRefundId ? ` · ${refund.gatewayRefundId}` : ''}
          </p>
          {refund.reason ? <p className="mt-4 text-body-sm text-ink-70">"{refund.reason}"</p> : null}
        </li>
      ))}
    </ul>
  );
}
