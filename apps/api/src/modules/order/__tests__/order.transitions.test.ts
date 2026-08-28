import { describe, expect, it } from 'vitest';
import type { OrderStatus, UserRole } from '@lulwah/contracts';
import { AppError } from '../../../shared/errors.js';
import { ALL_ORDER_STATUSES, assertRoleMayMakeTransition, assertValidOrderStatusTransition, getValidNextStatuses, isTerminalOrderStatus, isValidOrderStatusTransition } from '../order.transitions.js';

/**
 * Exhaustive coverage of the order status state machine — plan.md §8.7.2,
 * "the feature the brief calls out explicitly." Every (from, to) pair
 * across all twelve statuses (144 combinations) is checked, the same
 * exhaustive shape `apps/admin/lib/order-status.test.ts`'s 32-case suite
 * uses for its own copy of this exact table — this is what makes a future
 * accidental drift between the two files (admin's UI offering a transition
 * the API would then 409 on, or vice versa) a caught test failure here
 * rather than a support ticket.
 */

const VALID_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
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

describe('order.transitions — exhaustive (from, to) coverage', () => {
  for (const from of ALL_ORDER_STATUSES) {
    for (const to of ALL_ORDER_STATUSES) {
      const shouldBeValid = VALID_TRANSITIONS[from].includes(to);
      it(`${from} -> ${to} is ${shouldBeValid ? 'VALID' : 'invalid'}`, () => {
        expect(isValidOrderStatusTransition(from, to)).toBe(shouldBeValid);
      });
    }
  }

  it('getValidNextStatuses matches the table for every status', () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(getValidNextStatuses(status).sort()).toEqual([...VALID_TRANSITIONS[status]].sort());
    }
  });

  it('getValidNextStatuses returns a fresh array each call (caller cannot mutate the shared table)', () => {
    const a = getValidNextStatuses('pending_payment');
    a.push('refunded');
    const b = getValidNextStatuses('pending_payment');
    expect(b).not.toContain('refunded');
  });

  it('only `refunded` is terminal', () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(isTerminalOrderStatus(status)).toBe(status === 'refunded');
    }
  });

  describe('the two documented special cases', () => {
    it('out_for_delivery can roll back to shipped (failed delivery attempt)', () => {
      expect(isValidOrderStatusTransition('out_for_delivery', 'shipped')).toBe(true);
    });
    it('cancelled leads only to refunded', () => {
      expect(getValidNextStatuses('cancelled')).toEqual(['refunded']);
    });
  });
});

describe('assertValidOrderStatusTransition', () => {
  it('does not throw for any transition in the table', () => {
    for (const from of ALL_ORDER_STATUSES) {
      for (const to of VALID_TRANSITIONS[from]) {
        expect(() => assertValidOrderStatusTransition(from, to, { isForcedBySuperAdmin: false, reason: undefined })).not.toThrow();
      }
    }
  });

  it('throws 409 INVALID_STATUS_TRANSITION for a non-table transition when not forced', () => {
    try {
      assertValidOrderStatusTransition('pending_payment', 'delivered', { isForcedBySuperAdmin: false, reason: undefined });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.code).toBe('INVALID_STATUS_TRANSITION');
      expect(appErr.httpStatus).toBe(409);
      expect(appErr.details?.['validNextStatuses']).toEqual(['confirmed', 'failed', 'cancelled']);
    }
  });

  it('a refunded order (terminal) rejects every transition when not forced', () => {
    for (const to of ALL_ORDER_STATUSES) {
      expect(() => assertValidOrderStatusTransition('refunded', to, { isForcedBySuperAdmin: false, reason: undefined })).toThrow(AppError);
    }
  });

  it('super_admin forcing a non-table transition WITH a reason is allowed', () => {
    expect(() => assertValidOrderStatusTransition('refunded', 'confirmed', { isForcedBySuperAdmin: true, reason: 'Manual correction after a support investigation.' })).not.toThrow();
  });

  it('super_admin forcing a non-table transition WITHOUT a reason is rejected (400, mandatory reason)', () => {
    try {
      assertValidOrderStatusTransition('refunded', 'confirmed', { isForcedBySuperAdmin: true, reason: undefined });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('VALIDATION_FAILED');
      expect((err as AppError).httpStatus).toBe(400);
    }
  });

  it('super_admin forcing with a blank/whitespace-only reason is also rejected', () => {
    expect(() => assertValidOrderStatusTransition('refunded', 'confirmed', { isForcedBySuperAdmin: true, reason: '   ' })).toThrow(AppError);
  });

  it('a table-valid transition never requires a reason, forced flag or not', () => {
    expect(() => assertValidOrderStatusTransition('pending_payment', 'confirmed', { isForcedBySuperAdmin: true, reason: undefined })).not.toThrow();
    expect(() => assertValidOrderStatusTransition('pending_payment', 'confirmed', { isForcedBySuperAdmin: false, reason: undefined })).not.toThrow();
  });
});

/**
 * plan.md §10.2's `✏️*` footnote: `warehouse`/`support` hold the same
 * `orders.status.update` permission string as `manager`/`order_ops`, but
 * may only drive a restricted subset of the table. Exhaustive over all 144
 * (from, to) pairs for both restricted roles, matching this file's own
 * precedent above, plus confirming every other role is a complete no-op
 * (this function only narrows two roles, never rewrites the table).
 */
describe('assertRoleMayMakeTransition — plan.md §10.2 ✏️* footnote', () => {
  const WAREHOUSE_ALLOWED: ReadonlyArray<readonly [OrderStatus, OrderStatus]> = [
    ['processing', 'ready_to_ship'],
    ['ready_to_ship', 'shipped'],
  ];

  describe('warehouse — exhaustive (from, to) coverage', () => {
    for (const from of ALL_ORDER_STATUSES) {
      for (const to of ALL_ORDER_STATUSES) {
        const shouldBeAllowed = WAREHOUSE_ALLOWED.some(([f, t]) => f === from && t === to);
        it(`${from} -> ${to} is ${shouldBeAllowed ? 'ALLOWED' : 'rejected'} for warehouse`, () => {
          if (shouldBeAllowed) {
            expect(() => assertRoleMayMakeTransition('warehouse', from, to)).not.toThrow();
          } else {
            expect(() => assertRoleMayMakeTransition('warehouse', from, to)).toThrow(AppError);
          }
        });
      }
    }
  });

  describe('support — exhaustive (from, to) coverage', () => {
    for (const from of ALL_ORDER_STATUSES) {
      for (const to of ALL_ORDER_STATUSES) {
        const shouldBeAllowed = to === 'cancelled';
        it(`${from} -> ${to} is ${shouldBeAllowed ? 'ALLOWED' : 'rejected'} for support`, () => {
          if (shouldBeAllowed) {
            expect(() => assertRoleMayMakeTransition('support', from, to)).not.toThrow();
          } else {
            expect(() => assertRoleMayMakeTransition('support', from, to)).toThrow(AppError);
          }
        });
      }
    }
  });

  it('rejections are AUTH_FORBIDDEN/403 — distinct from the table-transition 409', () => {
    for (const role of ['warehouse', 'support'] as const) {
      try {
        assertRoleMayMakeTransition(role, 'confirmed', 'processing');
        expect.unreachable(`${role} should have been rejected for confirmed -> processing`);
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe('AUTH_FORBIDDEN');
        expect((err as AppError).httpStatus).toBe(403);
      }
    }
  });

  it('every other role holding orders.status.update is a complete no-op — full, unrestricted table access preserved', () => {
    const unrestrictedRoles: UserRole[] = ['super_admin', 'manager', 'order_ops'];
    for (const role of unrestrictedRoles) {
      for (const from of ALL_ORDER_STATUSES) {
        for (const to of ALL_ORDER_STATUSES) {
          // Never throws for these roles, table-valid pair or not — this
          // function only narrows warehouse/support; table validity itself
          // is assertValidOrderStatusTransition's separate job.
          expect(() => assertRoleMayMakeTransition(role, from, to)).not.toThrow();
        }
      }
    }
  });

  it('a role with no orders.status.update permission at all is also untouched by this function (it is a narrowing layer, never the sole gate)', () => {
    expect(() => assertRoleMayMakeTransition('customer', 'processing', 'cancelled')).not.toThrow();
  });
});
