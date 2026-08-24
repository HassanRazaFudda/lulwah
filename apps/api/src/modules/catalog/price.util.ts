/**
 * Pure price-display arithmetic — plan.md §8.2 steps 1, 3 and 4 only. Step
 * 2 ("apply automatic discounts") is deliberately skipped: no discount
 * engine exists yet (out of scope for this phase, per the brief), so
 * `effectivePriceFils` is just the stored price with nothing subtracted —
 * "final price" and "the price" are the same number today.
 *
 * `discountPercent` is still meaningful without a discount engine: it's
 * the plain compare-at-vs-price arithmetic the PDP's price-cut badge uses
 * (plan.md §8.2's own formula), driven only by whatever `compareAtPriceFils`
 * an admin has set — never invented.
 */
export function computePriceDisplay(priceFils: number, compareAtPriceFils: number | null): { effectivePriceFils: number; discountPercent: number } {
  const effectivePriceFils = priceFils;
  if (compareAtPriceFils === null || compareAtPriceFils <= effectivePriceFils) {
    return { effectivePriceFils, discountPercent: 0 };
  }
  const discountPercent = Math.round(((compareAtPriceFils - effectivePriceFils) / compareAtPriceFils) * 100);
  return { effectivePriceFils, discountPercent };
}
