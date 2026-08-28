import { describe, expect, it } from 'vitest';
import { emptyDiscountDraft } from './discount-draft';
import type { DiscountDraft } from './discount-draft';
import { estimateDiscountPreview } from './discount-preview';

function draft(overrides: Partial<DiscountDraft> = {}): DiscountDraft {
  return { ...emptyDiscountDraft(), ...overrides };
}

describe('estimateDiscountPreview', () => {
  it('percentage discount off a sample cart, matching the real engine\'s Math.round rule', () => {
    const result = estimateDiscountPreview(draft({ type: 'percentage', value: 20 }), 10_000);
    expect(result.supported).toBe(true);
    expect(result.discountFils).toBe(2_000);
    expect(result.message).toContain('AED 100.00');
    expect(result.message).toContain('AED 20.00 off');
  });

  it('rounds a percentage discount the same way the real engine does (round-half-up on .5 fils)', () => {
    // 333 * 0.15 = 49.95 -> rounds to 50
    const result = estimateDiscountPreview(draft({ type: 'percentage', value: 15 }), 333);
    expect(result.discountFils).toBe(50);
  });

  it('fixed_amount discount is capped at the sample subtotal, never exceeding it', () => {
    const result = estimateDiscountPreview(draft({ type: 'fixed_amount', value: 50_000 }), 10_000);
    expect(result.supported).toBe(true);
    expect(result.discountFils).toBe(10_000);
  });

  it('fixed_amount below the subtotal is applied as-is', () => {
    const result = estimateDiscountPreview(draft({ type: 'fixed_amount', value: 3_000 }), 10_000);
    expect(result.discountFils).toBe(3_000);
  });

  it('respects a minSubtotalFils condition — below minimum gives AED 0 with an explanation', () => {
    const result = estimateDiscountPreview(
      draft({ type: 'percentage', value: 20, conditions: { ...emptyDiscountDraft().conditions, minSubtotalFils: 20_000 } }),
      10_000,
    );
    expect(result.supported).toBe(true);
    expect(result.discountFils).toBe(0);
    expect(result.message).toMatch(/minimum spend/);
  });

  it('meeting a minSubtotalFils condition applies the discount normally', () => {
    const result = estimateDiscountPreview(
      draft({ type: 'percentage', value: 20, conditions: { ...emptyDiscountDraft().conditions, minSubtotalFils: 5_000 } }),
      10_000,
    );
    expect(result.discountFils).toBe(2_000);
  });

  it('declines to estimate a targeted discount (appliesTo !== "all")', () => {
    const result = estimateDiscountPreview(draft({ type: 'percentage', value: 20, appliesTo: 'products', targetIds: ['a'] }), 10_000);
    expect(result.supported).toBe(false);
    expect(result.discountFils).toBe(0);
  });

  it('declines to estimate when exclusions are set', () => {
    const result = estimateDiscountPreview(draft({ type: 'percentage', value: 20, excludeIds: ['b'] }), 10_000);
    expect(result.supported).toBe(false);
  });

  it('declines to estimate tiered/buy_x_get_y/bundle/free_shipping types', () => {
    for (const type of ['tiered', 'buy_x_get_y', 'bundle', 'free_shipping'] as const) {
      const result = estimateDiscountPreview(draft({ type }), 10_000);
      expect(result.supported).toBe(false);
      expect(result.discountFils).toBe(0);
    }
  });

  it('declines to estimate when a minQuantity condition is set', () => {
    const result = estimateDiscountPreview(
      draft({ type: 'percentage', value: 20, conditions: { ...emptyDiscountDraft().conditions, minQuantity: 2 } }),
      10_000,
    );
    expect(result.supported).toBe(false);
  });

  it('a zero or negative sample subtotal asks for input rather than showing a number', () => {
    const result = estimateDiscountPreview(draft({ type: 'percentage', value: 20 }), 0);
    expect(result.supported).toBe(true);
    expect(result.discountFils).toBe(0);
    expect(result.message).toMatch(/Enter a sample cart subtotal/);
  });
});
