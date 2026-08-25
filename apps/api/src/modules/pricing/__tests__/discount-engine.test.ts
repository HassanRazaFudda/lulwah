import { describe, expect, it } from 'vitest';
import type { Discount } from '@lulwah/contracts';
import { applyDiscounts, proRataAllocate } from '../discount-engine.js';
import type { CartLineSnapshot, CartSnapshot, DiscountEligibilityContext } from '../discount-engine.js';

/**
 * Unit coverage for the pure `applyDiscounts()` — plan.md §8.3. No Mongo,
 * no Express: every input is hand-built, exactly the "framework-free,
 * unit-testable in isolation" the brief calls for. Prioritized per the
 * brief: the pro-rata rounding invariant (`Σ lineDiscounts ===
 * orderDiscountFils` exactly) gets its own dedicated tests.
 */

function baseCtx(overrides: Partial<DiscountEligibilityContext> = {}): DiscountEligibilityContext {
  return {
    now: new Date('2026-06-01T00:00:00Z'),
    isFirstOrder: false,
    customerTags: [],
    paymentMethod: null,
    emirate: null,
    currentShippingFils: 0,
    perCustomerUsage: {},
    ...overrides,
  };
}

function line(overrides: Partial<CartLineSnapshot> = {}): CartLineSnapshot {
  return {
    itemId: 'item-1',
    productId: 'prod-1',
    variantId: 'var-1',
    categoryIds: [],
    brandId: 'brand-1',
    collectionIds: [],
    quantity: 1,
    unitPriceFils: 10_000,
    lineTotalFils: 10_000,
    ...overrides,
  };
}

function discount(overrides: Partial<Discount> = {}): Discount {
  const now = new Date();
  return {
    id: overrides.id ?? 'disc-1',
    name: 'Test discount',
    internalDescription: '',
    mode: 'automatic',
    code: null,
    type: 'percentage',
    value: 10,
    tiers: null,
    buyXGetY: null,
    appliesTo: 'all',
    targetIds: [],
    excludeIds: [],
    conditions: {
      minSubtotalFils: null,
      minQuantity: null,
      firstOrderOnly: false,
      customerTags: null,
      emirates: null,
      paymentMethods: null,
      startsAt: null,
      endsAt: null,
    },
    usage: { limitTotal: null, limitPerCustomer: null, usedCount: 0 },
    stackable: false,
    priority: 100,
    status: 'active',
    showOnProductCard: false,
    bannerTextEn: '',
    bannerTextAr: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('proRataAllocate', () => {
  it('distributes an amount proportionally with the remainder going to the largest line', () => {
    // 100 fils across lines worth 30/30/40 (totalling 100) split 3 ways
    // that doesn't divide evenly is exactly the case the remainder rule
    // exists for.
    const result = proRataAllocate(10, [
      { itemId: 'a', baseFils: 3 },
      { itemId: 'b', baseFils: 3 },
      { itemId: 'c', baseFils: 4 },
    ]);
    const sum = [...result.values()].reduce((s, v) => s + v, 0);
    expect(sum).toBe(10);
    // floor(10*3/10)=3, floor(10*3/10)=3, floor(10*4/10)=4 → allocated=10, remainder=0
    expect(result.get('a')).toBe(3);
    expect(result.get('b')).toBe(3);
    expect(result.get('c')).toBe(4);
  });

  it('always sums to exactly amountFils even with awkward rounding', () => {
    // 3-way split of 100 that doesn't divide evenly: floor(100/3)=33 each, remainder 1.
    const result = proRataAllocate(100, [
      { itemId: 'a', baseFils: 1 },
      { itemId: 'b', baseFils: 1 },
      { itemId: 'c', baseFils: 1 },
    ]);
    const sum = [...result.values()].reduce((s, v) => s + v, 0);
    expect(sum).toBe(100);
  });

  it('gives the remainder to the largest line, not an arbitrary one', () => {
    const result = proRataAllocate(10, [
      { itemId: 'small', baseFils: 1 },
      { itemId: 'big', baseFils: 99 },
    ]);
    const sum = [...result.values()].reduce((s, v) => s + v, 0);
    expect(sum).toBe(10);
    // floor(10*1/100)=0, floor(10*99/100)=9, remainder=1 → goes to "big"
    expect(result.get('small')).toBe(0);
    expect(result.get('big')).toBe(10);
  });

  it('returns an empty map for a non-positive amount or no lines', () => {
    expect(proRataAllocate(0, [{ itemId: 'a', baseFils: 10 }]).size).toBe(0);
    expect(proRataAllocate(10, []).size).toBe(0);
  });
});

describe('applyDiscounts — pro-rata invariant across a full run', () => {
  it('Σ lineDiscounts === orderDiscountFils exactly, for an odd multi-line percentage split', () => {
    const cart: CartSnapshot = {
      lines: [
        line({ itemId: 'i1', lineTotalFils: 3_333, unitPriceFils: 3_333 }),
        line({ itemId: 'i2', lineTotalFils: 3_333, unitPriceFils: 3_333 }),
        line({ itemId: 'i3', lineTotalFils: 3_334, unitPriceFils: 3_334 }),
      ],
      subtotalFils: 10_000,
      couponCodes: [],
    };
    const d = discount({ type: 'percentage', value: 17 }); // an awkward percentage
    const result = applyDiscounts(cart, [d], baseCtx());

    const sumLineDiscounts = [...result.lineDiscounts.values()].reduce((s, v) => s + v, 0);
    expect(sumLineDiscounts).toBe(result.orderDiscountFils);
    expect(result.orderDiscountFils).toBe(Math.round(10_000 * 0.17));
  });

  it('holds even when two stacked discounts both allocate across the same lines', () => {
    const cart: CartSnapshot = {
      lines: [line({ itemId: 'i1', lineTotalFils: 7_777, unitPriceFils: 7_777 }), line({ itemId: 'i2', lineTotalFils: 2_223, unitPriceFils: 2_223 })],
      subtotalFils: 10_000,
      couponCodes: [],
    };
    const d1 = discount({ id: 'd1', type: 'percentage', value: 13, stackable: true, priority: 1 });
    const d2 = discount({ id: 'd2', type: 'fixed_amount', value: 500, stackable: true, priority: 2 });
    const result = applyDiscounts(cart, [d1, d2], baseCtx());

    const sumLineDiscounts = [...result.lineDiscounts.values()].reduce((s, v) => s + v, 0);
    expect(sumLineDiscounts).toBe(result.orderDiscountFils);
    expect(result.applied).toHaveLength(2);
  });
});

describe('applyDiscounts — stacking rules', () => {
  it('a non-stackable discount terminates every discount after it, even a stackable one', () => {
    const cart: CartSnapshot = { lines: [line()], subtotalFils: 10_000, couponCodes: [] };
    const nonStackable = discount({ id: 'd1', priority: 1, stackable: false, type: 'percentage', value: 10 });
    const wouldStack = discount({ id: 'd2', priority: 2, stackable: true, type: 'percentage', value: 5 });
    const result = applyDiscounts(cart, [nonStackable, wouldStack], baseCtx());

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]?.discountId).toBe('d1');
    expect(result.orderDiscountFils).toBe(1_000); // only the 10%, not both
  });

  it('two stackable discounts both apply, compounding on the remaining amount', () => {
    const cart: CartSnapshot = { lines: [line({ lineTotalFils: 10_000, unitPriceFils: 10_000 })], subtotalFils: 10_000, couponCodes: [] };
    const d1 = discount({ id: 'd1', priority: 1, stackable: true, type: 'percentage', value: 10 });
    const d2 = discount({ id: 'd2', priority: 2, stackable: true, type: 'percentage', value: 10 });
    const result = applyDiscounts(cart, [d1, d2], baseCtx());

    // d1: 10% of 10,000 = 1,000 → remaining 9,000. d2: 10% of 9,000 = 900.
    expect(result.applied).toHaveLength(2);
    expect(result.orderDiscountFils).toBe(1_900);
  });

  it('free_shipping is a separate lane that always stacks alongside a non-stackable order discount', () => {
    const cart: CartSnapshot = { lines: [line()], subtotalFils: 10_000, couponCodes: [] };
    const nonStackable = discount({ id: 'd1', priority: 1, stackable: false, type: 'percentage', value: 10 });
    const freeShip = discount({ id: 'd2', priority: 2, type: 'free_shipping' });
    const result = applyDiscounts(cart, [nonStackable, freeShip], baseCtx({ currentShippingFils: 1_500 }));

    expect(result.applied.map((a) => a.discountId).sort()).toEqual(['d1', 'd2']);
    expect(result.shippingDiscountFils).toBe(1_500);
    expect(result.orderDiscountFils).toBe(1_000); // free-shipping never touches the order lane
  });
});

describe('applyDiscounts — targeting and exclusions', () => {
  it('only discounts lines the target actually matches', () => {
    const cart: CartSnapshot = {
      lines: [line({ itemId: 'i1', categoryIds: ['cat-bridal'], lineTotalFils: 5_000, unitPriceFils: 5_000 }), line({ itemId: 'i2', categoryIds: ['cat-lawn'], lineTotalFils: 5_000, unitPriceFils: 5_000 })],
      subtotalFils: 10_000,
      couponCodes: [],
    };
    const d = discount({ appliesTo: 'categories', targetIds: ['cat-lawn'], type: 'percentage', value: 20 });
    const result = applyDiscounts(cart, [d], baseCtx());

    expect(result.orderDiscountFils).toBe(1_000); // 20% of the lawn line only
    expect(result.lineDiscounts.get('i2')).toBe(1_000);
    expect(result.lineDiscounts.has('i1')).toBe(false);
  });

  it('excludeIds removes a line even when appliesTo: all would otherwise match it', () => {
    const cart: CartSnapshot = {
      lines: [line({ itemId: 'i1', categoryIds: ['cat-bridal'], lineTotalFils: 5_000, unitPriceFils: 5_000 }), line({ itemId: 'i2', categoryIds: ['cat-lawn'], lineTotalFils: 5_000, unitPriceFils: 5_000 })],
      subtotalFils: 10_000,
      couponCodes: [],
    };
    const d = discount({ appliesTo: 'all', excludeIds: ['cat-bridal'], type: 'percentage', value: 10 });
    const result = applyDiscounts(cart, [d], baseCtx());

    expect(result.lineDiscounts.has('i1')).toBe(false);
    expect(result.lineDiscounts.get('i2')).toBe(500);
  });
});

describe('applyDiscounts — coupon rejection reasons', () => {
  it('rejects a code that matches nothing with COUPON_INVALID', () => {
    const cart: CartSnapshot = { lines: [line()], subtotalFils: 10_000, couponCodes: ['NOPE'] };
    const result = applyDiscounts(cart, [], baseCtx());
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.errorCode).toBe('COUPON_INVALID');
  });

  it('rejects with a specific reason when the code exists but the cart is below minSubtotal', () => {
    const cart: CartSnapshot = { lines: [line({ lineTotalFils: 1_000, unitPriceFils: 1_000 })], subtotalFils: 1_000, couponCodes: ['SAVE50'] };
    const d = discount({ mode: 'code', code: 'SAVE50', conditions: { ...discount().conditions, minSubtotalFils: 15_000 } });
    const result = applyDiscounts(cart, [d], baseCtx());

    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.errorCode).toBe('COUPON_MIN_SUBTOTAL');
    expect(result.rejected[0]?.reason).not.toBe('Invalid code.');
    expect(result.rejected[0]?.reason.length).toBeGreaterThan(0);
  });

  it('rejects an expired code with COUPON_EXPIRED, not a generic message', () => {
    const cart: CartSnapshot = { lines: [line()], subtotalFils: 10_000, couponCodes: ['OLD10'] };
    const d = discount({ mode: 'code', code: 'OLD10', conditions: { ...discount().conditions, endsAt: new Date('2020-01-01') } });
    const result = applyDiscounts(cart, [d], baseCtx());
    expect(result.rejected[0]?.errorCode).toBe('COUPON_EXPIRED');
  });

  it('rejects a code that has hit its total usage limit', () => {
    const cart: CartSnapshot = { lines: [line()], subtotalFils: 10_000, couponCodes: ['LIMITED'] };
    const d = discount({ mode: 'code', code: 'LIMITED', usage: { limitTotal: 5, limitPerCustomer: null, usedCount: 5 } });
    const result = applyDiscounts(cart, [d], baseCtx());
    expect(result.rejected[0]?.errorCode).toBe('COUPON_USAGE_LIMIT');
  });

  it('accepts a valid code and reflects it in `applied`', () => {
    const cart: CartSnapshot = { lines: [line({ lineTotalFils: 10_000, unitPriceFils: 10_000 })], subtotalFils: 10_000, couponCodes: ['welcome10'] };
    const d = discount({ mode: 'code', code: 'WELCOME10', type: 'percentage', value: 10 });
    const result = applyDiscounts(cart, [d], baseCtx());
    expect(result.rejected).toHaveLength(0);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]?.code).toBe('WELCOME10');
    expect(result.orderDiscountFils).toBe(1_000);
  });
});

describe('applyDiscounts — caps and edge cases', () => {
  it('never lets total discount exceed the subtotal, and still keeps the invariant exact', () => {
    const cart: CartSnapshot = { lines: [line({ lineTotalFils: 1_000, unitPriceFils: 1_000 })], subtotalFils: 1_000, couponCodes: [] };
    // A silly fixed-amount discount bigger than the subtotal.
    const d = discount({ type: 'fixed_amount', value: 50_000 });
    const result = applyDiscounts(cart, [d], baseCtx());

    expect(result.orderDiscountFils).toBe(1_000);
    const sum = [...result.lineDiscounts.values()].reduce((s, v) => s + v, 0);
    expect(sum).toBe(1_000);
  });

  it('firstOrderOnly rejects a repeat customer’s code but allows a first-time one', () => {
    const cart: CartSnapshot = { lines: [line()], subtotalFils: 10_000, couponCodes: ['NEWBIE'] };
    const d = discount({ mode: 'code', code: 'NEWBIE', conditions: { ...discount().conditions, firstOrderOnly: true } });

    const repeatResult = applyDiscounts(cart, [d], baseCtx({ isFirstOrder: false }));
    expect(repeatResult.rejected[0]?.errorCode).toBe('COUPON_NOT_ELIGIBLE');

    const firstResult = applyDiscounts(cart, [d], baseCtx({ isFirstOrder: true }));
    expect(firstResult.rejected).toHaveLength(0);
    expect(firstResult.applied).toHaveLength(1);
  });

  it('an ineligible automatic discount is silently skipped — no rejected entry (nothing was explicitly requested)', () => {
    const cart: CartSnapshot = { lines: [line({ lineTotalFils: 100, unitPriceFils: 100 })], subtotalFils: 100, couponCodes: [] };
    const d = discount({ mode: 'automatic', conditions: { ...discount().conditions, minSubtotalFils: 999_999 } });
    const result = applyDiscounts(cart, [d], baseCtx());
    expect(result.applied).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });
});
