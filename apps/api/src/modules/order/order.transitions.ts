import type { OrderStatus, UserRole } from '@lulwah/contracts';
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
 * system-driven transitions this module makes on its own — e.g. a Ziina
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

// ---------------------------------------------------------------------------
// plan.md §10.2's `✏️*` footnote — the restricted-subset enforcement the
// permission string alone can't express.
// ---------------------------------------------------------------------------

/**
 * `warehouse`'s entire allowed slice of the state machine: the pack-and-ship
 * chain, and nothing else — not even a transition that's perfectly legal in
 * `ORDER_STATUS_TRANSITIONS` for another role (e.g. `processing -> cancelled`
 * is a real table transition, but not one `warehouse` may make).
 */
const WAREHOUSE_ALLOWED_TRANSITIONS: ReadonlyArray<readonly [OrderStatus, OrderStatus]> = [
  ['processing', 'ready_to_ship'],
  ['ready_to_ship', 'shipped'],
];

/**
 * `support`'s allowed target status: `cancelled`, from whatever `from` state
 * the base table already permits (`pending_payment`/`confirmed`/`processing`
 * /`stitching`/`ready_to_ship` all lead to `cancelled` there) — expressed as
 * a target-status rule rather than duplicating those five pairs by hand, so
 * it can't silently drift if `ORDER_STATUS_TRANSITIONS` itself is edited.
 * "and re-send notifications" (the other half of the plan.md footnote) has
 * no corresponding endpoint anywhere in this codebase — there is no
 * standalone "resend" action, only the `notifyCustomer` flag on a status
 * change itself — so that half of the footnote is not enforced here because
 * there is nothing to enforce; it stays an aspirational/R2 note, not
 * invented against nothing.
 */
const SUPPORT_ALLOWED_TARGET_STATUSES: readonly OrderStatus[] = ['cancelled'];

/** Roles this restriction actually narrows. Every other role holding
 *  `orders.status.update` (`super_admin`, `manager`, `order_ops`) keeps
 *  full, unrestricted access to whatever `ORDER_STATUS_TRANSITIONS` (or the
 *  `super_admin` force escape hatch) already allows them — this function is
 *  a strictly additional narrowing layered on top for exactly these two
 *  roles, never a rewrite of the table itself. */
const ROLES_WITH_RESTRICTED_TRANSITIONS: ReadonlySet<UserRole> = new Set(['warehouse', 'support']);

/**
 * Enforces plan.md §10.2's `✏️*` footnote: "`warehouse` may only set
 * `processing → ready_to_ship → shipped`; `support` may only set
 * `cancelled`". Called from `order.service.ts#updateOrderStatus` — the one
 * place a role-carrying actor (as opposed to a system/webhook-driven
 * transition, which has no role to restrict) requests a status change.
 * Layered strictly on top of `assertValidOrderStatusTransition`: a
 * `warehouse`/`support` actor must pass both this AND the base table check
 * (though every pair this function allows is already table-valid, so in
 * practice this is the tighter of the two gates for these two roles).
 * Never called for, or applicable to, `super_admin`'s force path.
 */
export function assertRoleMayMakeTransition(role: UserRole, from: OrderStatus, to: OrderStatus): void {
  if (!ROLES_WITH_RESTRICTED_TRANSITIONS.has(role)) return;

  if (role === 'warehouse') {
    const allowed = WAREHOUSE_ALLOWED_TRANSITIONS.some(([f, t]) => f === from && t === to);
    if (allowed) return;
    throw new AppError('AUTH_FORBIDDEN', 403, {
      messageEn: `The warehouse role may only move an order processing → ready_to_ship → shipped; "${from}" → "${to}" is outside that subset.`,
      details: { role, from, to, allowedTransitions: WAREHOUSE_ALLOWED_TRANSITIONS },
    });
  }

  if (role === 'support') {
    if (SUPPORT_ALLOWED_TARGET_STATUSES.includes(to)) return;
    throw new AppError('AUTH_FORBIDDEN', 403, {
      messageEn: `The support role may only cancel orders; "${from}" → "${to}" is outside that subset.`,
      details: { role, from, to, allowedTargetStatuses: SUPPORT_ALLOWED_TARGET_STATUSES },
    });
  }
}
