import { describe, expect, it } from 'vitest';
import type { OrderStatus } from '@lulwah/contracts';
import {
  ALL_ORDER_STATUSES,
  getValidNextStatuses,
  isTerminalOrderStatus,
  isValidOrderStatusTransition,
  ORDER_STATUS_META,
} from './order-status';

/**
 * plan.md §8.7.2, reproduced verbatim as the expected table. This test
 * exists to make `lib/order-status.ts` provably match the plan, not to
 * describe generic "state machine" behaviour — every entry below is a
 * value copied out of the spec, not derived.
 */
const EXPECTED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
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

describe('getValidNextStatuses', () => {
  it('covers all twelve §8.7.1 states with no gaps and no extras', () => {
    expect(ALL_ORDER_STATUSES).toHaveLength(12);
    expect(new Set(ALL_ORDER_STATUSES).size).toBe(12);
    expect(Object.keys(EXPECTED_TRANSITIONS).sort()).toEqual([...ALL_ORDER_STATUSES].sort());
  });

  it.each(ALL_ORDER_STATUSES)('returns exactly the §8.7.2 next states for "%s"', (status) => {
    expect(getValidNextStatuses(status)).toEqual(EXPECTED_TRANSITIONS[status]);
  });

  // Named cases per the task brief, spelled out individually so a
  // regression on any single state fails with an unambiguous message
  // rather than only showing up in the table-driven loop above.

  it('pending_payment -> confirmed | failed | cancelled', () => {
    expect(getValidNextStatuses('pending_payment')).toEqual(['confirmed', 'failed', 'cancelled']);
  });

  it('confirmed -> processing | cancelled', () => {
    expect(getValidNextStatuses('confirmed')).toEqual(['processing', 'cancelled']);
  });

  it('processing -> stitching | ready_to_ship | cancelled', () => {
    expect(getValidNextStatuses('processing')).toEqual(['stitching', 'ready_to_ship', 'cancelled']);
  });

  it('stitching -> ready_to_ship | cancelled', () => {
    expect(getValidNextStatuses('stitching')).toEqual(['ready_to_ship', 'cancelled']);
  });

  it('ready_to_ship -> shipped | cancelled', () => {
    expect(getValidNextStatuses('ready_to_ship')).toEqual(['shipped', 'cancelled']);
  });

  it('shipped is a branching state: out_for_delivery | delivered | returned', () => {
    const next = getValidNextStatuses('shipped');
    expect(next).toEqual(['out_for_delivery', 'delivered', 'returned']);
    expect(next).toHaveLength(3);
  });

  it('out_for_delivery is a branching state: delivered | shipped (failed attempt) | returned', () => {
    const next = getValidNextStatuses('out_for_delivery');
    expect(next).toEqual(['delivered', 'shipped', 'returned']);
    // The special case: a failed delivery attempt steps BACK to `shipped`,
    // not forward to a new state.
    expect(next).toContain('shipped');
  });

  it('delivered is terminal except for returned', () => {
    expect(getValidNextStatuses('delivered')).toEqual(['returned']);
  });

  it('cancelled -> refunded only, even though only meaningful if the order was paid', () => {
    expect(getValidNextStatuses('cancelled')).toEqual(['refunded']);
  });

  it('returned -> refunded only', () => {
    expect(getValidNextStatuses('returned')).toEqual(['refunded']);
  });

  it('refunded is fully terminal: no valid next states', () => {
    expect(getValidNextStatuses('refunded')).toEqual([]);
  });

  it('failed -> pending_payment only (customer retries)', () => {
    expect(getValidNextStatuses('failed')).toEqual(['pending_payment']);
  });

  it('never includes the current state itself as a next state', () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(getValidNextStatuses(status)).not.toContain(status);
    }
  });

  it('returns a fresh array each call — callers cannot mutate the shared table', () => {
    const first = getValidNextStatuses('pending_payment');
    first.push('delivered');
    const second = getValidNextStatuses('pending_payment');
    expect(second).toEqual(['confirmed', 'failed', 'cancelled']);
  });
});

describe('isValidOrderStatusTransition', () => {
  it('agrees with getValidNextStatuses for every legal transition', () => {
    for (const status of ALL_ORDER_STATUSES) {
      for (const next of getValidNextStatuses(status)) {
        expect(isValidOrderStatusTransition(status, next)).toBe(true);
      }
    }
  });

  it('rejects transitions absent from the §8.7.2 table', () => {
    // A sample of illegal jumps, including a couple that look plausible at
    // a glance (skipping a step, going "backwards" outside the one
    // documented exception) — the whole point of the table is that these
    // must return 409 INVALID_STATUS_TRANSITION server-side, and must never
    // appear as a dropdown option here.
    expect(isValidOrderStatusTransition('pending_payment', 'shipped')).toBe(false);
    expect(isValidOrderStatusTransition('confirmed', 'delivered')).toBe(false);
    expect(isValidOrderStatusTransition('shipped', 'ready_to_ship')).toBe(false);
    expect(isValidOrderStatusTransition('delivered', 'refunded')).toBe(false);
    expect(isValidOrderStatusTransition('cancelled', 'processing')).toBe(false);
    expect(isValidOrderStatusTransition('refunded', 'pending_payment')).toBe(false);
  });
});

describe('isTerminalOrderStatus', () => {
  it('is true only for refunded', () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(isTerminalOrderStatus(status)).toBe(status === 'refunded');
    }
  });
});

describe('ORDER_STATUS_META', () => {
  it('has an EN and AR label for all twelve states', () => {
    for (const status of ALL_ORDER_STATUSES) {
      expect(ORDER_STATUS_META[status].labelEn.length).toBeGreaterThan(0);
      expect(ORDER_STATUS_META[status].labelAr.length).toBeGreaterThan(0);
    }
  });

  it('matches the §8.7.1 table verbatim', () => {
    expect(ORDER_STATUS_META.pending_payment).toEqual({ labelEn: 'Awaiting payment', labelAr: 'بانتظار الدفع' });
    expect(ORDER_STATUS_META.delivered).toEqual({ labelEn: 'Delivered', labelAr: 'تم التوصيل' });
    expect(ORDER_STATUS_META.failed).toEqual({ labelEn: 'Payment failed', labelAr: 'فشل الدفع' });
  });
});
