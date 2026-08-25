import type { OrderStatus } from '@lulwah/contracts';
import { AppError } from '../../shared/errors.js';

/**
 * The order status state machine — plan.md §8.7.2, "the feature the brief
 * calls out explicitly." This table is a byte-for-byte mirror of
 * `apps/admin/lib/order-status.ts`'s `ORDER_STATUS_TRANSITIONS` — that file
 * is what the admin's `StatusTransitionDropdown` renders from (so it never
 * offers an option the API would reject), and this file is what
 * `PATCH /admin/orders/:id/status` actually enforces server-side. There is
 * no shared package import between `apps/admin` (a Next app) and
 * `apps/api` for this table today, so the two copies must be kept in sync
 * by hand — this file's own test suite (`__tests__/order.transitions.test
 * .ts`) enumerates every (from, to) pair for all twelve statuses, the same
 * exhaustive shape admin's 32-case suite uses, specifically so a future
 * edit to either file that drifts from the other gets caught here, not in
 * a support ticket.
 *
 * Both documented special cases carry over verbatim:
 *  - `out_for_delivery` can step *back* to `shipped` (a failed delivery
 *    attempt, not a new shipment).
 *  - `cancelled` leads only to `refunded`.
 *
 * `super_admin` may force any transition outside this table (plan.md
 * §8.7.2, §10.2) — `assertValidOrderStatusTransition` below is what
 * implements that escape hatch, with a mandatory audited reason.
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

/** Returns the legally valid next states for `current` — nothing else.
 *  Fresh array each call so a caller can't mutate the shared table. */
export function getValidNextStatuses(current: OrderStatus): OrderStatus[] {
  return [...ORDER_STATUS_TRANSITIONS[current]];
}

/** True if `to` is a legal next state from `from` under the table alone
 *  (never true for a `super_admin` force — that's a distinct, audited
 *  path, see `assertValidOrderStatusTransition`). */
export function isValidOrderStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/** A status with no valid next states — `refunded` is the only one. */
export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status].length === 0;
}

/** All twelve states, in the order plan.md §8.7.1 lists them. */
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

/**
 * The one place `PATCH /admin/orders/:id/status` (and the internal
 * system-driven transitions this module makes on its own — e.g. a Stripe
 * webhook confirming payment) gates a status change through. Throws `409
 * INVALID_STATUS_TRANSITION` for anything not in the table, UNLESS
 * `isForcedBySuperAdmin` is true — in which case the transition is allowed
 * regardless of the table, but only when `reason` is a genuine non-empty
 * string (plan.md §8.7.2: "audited, with a mandatory reason").
 */
export function assertValidOrderStatusTransition(from: OrderStatus, to: OrderStatus, opts: { isForcedBySuperAdmin: boolean; reason?: string | undefined }): void {
  if (isValidOrderStatusTransition(from, to)) return;

  if (opts.isForcedBySuperAdmin) {
    if (!opts.reason || opts.reason.trim().length === 0) {
      throw new AppError('VALIDATION_FAILED', 400, {
        messageEn: 'A reason is required to force a status change outside the normal workflow.',
        field: 'note',
      });
    }
    return;
  }

  throw new AppError('INVALID_STATUS_TRANSITION', 409, {
    messageEn: `An order cannot move from "${from}" to "${to}".`,
    details: { from, to, validNextStatuses: getValidNextStatuses(from) },
  });
}
