import type { OrderStatus } from '@lulwah/contracts';

/**
 * The delivery-tracking state machine — plan.md §8.7.2, copied verbatim,
 * including its two special cases:
 *
 *  - `out_for_delivery` can step *back* to `shipped` (a failed delivery
 *    attempt, not a new shipment).
 *  - `cancelled` leads only to `refunded`, which is "only meaningful if the
 *    order had been paid" — the plan still lists it as the sole valid next
 *    state, so an unpaid cancelled order shows the same single option; the
 *    unpaid case is a business decision for the refund flow to short-circuit,
 *    not a reason to omit the transition here.
 *
 * `super_admin` may force any transition outside this table (§8.7.2,
 * §10.2) — out of scope for this skeleton. This is the ONLY place the
 * transition rules are encoded; `StatusTransitionDropdown` and any future
 * bulk-status UI must both read through `getValidNextStatuses` rather than
 * re-deriving the rules, so the "invalid options are never rendered"
 * guarantee (§8.7.4) has exactly one source of truth.
 */
const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['confirmed', 'failed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['stitching', 'ready_to_ship', 'cancelled'],
  stitching: ['ready_to_ship', 'cancelled'],
  ready_to_ship: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered', 'returned'],
  out_for_delivery: ['delivered', 'shipped', 'returned'],
  delivered: ['returned'],
  cancelled: ['refunded'],
  returned: ['refunded'],
  refunded: [],
  failed: ['pending_payment'],
};

/**
 * Returns the legally valid next states for `current` — nothing else. Used
 * to build the admin status dropdown (§8.7.4: "a dropdown showing only
 * legally valid next states — invalid ones are not rendered at all, it is
 * impossible to make a mistake") and, later, to validate `PATCH
 * /admin/orders/:id/status` server-side (§9.7) against the same rules.
 *
 * Returns a fresh array each call so a caller can't mutate the shared table.
 */
export function getValidNextStatuses(current: OrderStatus): OrderStatus[] {
  return [...ORDER_STATUS_TRANSITIONS[current]];
}

/** True if `to` is a legal next state from `from` — the same rule as
 *  `getValidNextStatuses`, phrased as a predicate for guard clauses. */
export function isValidOrderStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/** A status with no valid next states — `refunded` is the only one. Used to
 *  render "no further action" instead of an empty, confusing dropdown. */
export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status].length === 0;
}

export interface OrderStatusMeta {
  readonly labelEn: string;
  readonly labelAr: string;
}

/** Customer-facing labels — plan.md §8.7.1's table, transcribed verbatim
 *  (EN + AR). The admin pill shows the EN label (§StatusFlagPill); AR is
 *  carried here too so the same source of truth can back the customer
 *  tracking timeline (§8.7.5) when that screen is built. */
export const ORDER_STATUS_META: Record<OrderStatus, OrderStatusMeta> = {
  pending_payment: { labelEn: 'Awaiting payment', labelAr: 'بانتظار الدفع' },
  confirmed: { labelEn: 'Order confirmed', labelAr: 'تم تأكيد الطلب' },
  processing: { labelEn: 'Preparing your order', labelAr: 'قيد التجهيز' },
  stitching: { labelEn: 'With our tailor', labelAr: 'لدى الخياط' },
  ready_to_ship: { labelEn: 'Ready to ship', labelAr: 'جاهز للشحن' },
  shipped: { labelEn: 'Shipped', labelAr: 'تم الشحن' },
  out_for_delivery: { labelEn: 'Out for delivery', labelAr: 'خارج للتوصيل' },
  delivered: { labelEn: 'Delivered', labelAr: 'تم التوصيل' },
  cancelled: { labelEn: 'Cancelled', labelAr: 'ملغى' },
  returned: { labelEn: 'Returned', labelAr: 'مُرجَع' },
  refunded: { labelEn: 'Refunded', labelAr: 'تم استرداد المبلغ' },
  failed: { labelEn: 'Payment failed', labelAr: 'فشل الدفع' },
};

/** All twelve states, in the order plan.md §8.7.1 lists them — used to
 *  iterate exhaustively (this file's test, any future admin filter list). */
export const ALL_ORDER_STATUSES: readonly OrderStatus[] = [
  'pending_payment',
  'confirmed',
  'processing',
  'stitching',
  'ready_to_ship',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
  'failed',
];
