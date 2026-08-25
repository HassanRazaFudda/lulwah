import { describe, expect, it } from 'vitest';
import type { OrderStatus } from '@lulwah/contracts';
import { AppError } from '../../../shared/errors.js';
import { ALL_ORDER_STATUSES, assertValidOrderStatusTransition, getValidNextStatuses, isTerminalOrderStatus, isValidOrderStatusTransition } from '../order.transitions.js';

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
