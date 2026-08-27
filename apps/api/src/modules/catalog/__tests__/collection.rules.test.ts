import { describe, expect, it } from 'vitest';
import type { CollectionRule } from '@lulwah/contracts';
import { buildAutomatedProductFilter } from '../collection.rules.js';

/** plan.md §7.9's automated-collection rule engine — translates
 *  `rules[]` into `product.repository.ts`'s existing `ProductListFilter`,
 *  reusing the same facet-filtering machinery `GET /products` already
 *  exercises rather than a second query builder. */
describe('buildAutomatedProductFilter', () => {
  it('always scopes to active products, even with zero rules', () => {
    expect(buildAutomatedProductFilter([])).toEqual({ status: 'active' });
  });

  it('maps an eq rule on an enum-ish field straight through', () => {
    const rules: CollectionRule[] = [{ field: 'fabric', operator: 'eq', value: 'lawn' }];
    expect(buildAutomatedProductFilter(rules)).toEqual({ status: 'active', fabric: 'lawn' });
  });

  it('maps gte/lte on priceFils to min/maxPriceFils', () => {
    const rules: CollectionRule[] = [
      { field: 'priceFils', operator: 'gte', value: 5_000 },
      { field: 'priceFils', operator: 'lte', value: 20_000 },
    ];
    expect(buildAutomatedProductFilter(rules)).toEqual({ status: 'active', minPriceFils: 5_000, maxPriceFils: 20_000 });
  });

  it('maps boolean rules (onSale, inStock)', () => {
    const rules: CollectionRule[] = [
      { field: 'onSale', operator: 'eq', value: true },
      { field: 'inStock', operator: 'eq', value: true },
    ];
    expect(buildAutomatedProductFilter(rules)).toEqual({ status: 'active', onSale: true, inStock: true });
  });

  it('degenerates an `in` rule to its first value rather than throwing', () => {
    const rules: CollectionRule[] = [{ field: 'colorFamily', operator: 'in', value: ['blue_ferozi', 'green'] }];
    expect(buildAutomatedProductFilter(rules)).toEqual({ status: 'active', colorFamily: 'blue_ferozi' });
  });

  it('combines multiple rules into one filter', () => {
    const rules: CollectionRule[] = [
      { field: 'stitchingType', operator: 'eq', value: 'unstitched' },
      { field: 'occasion', operator: 'eq', value: 'eid' },
    ];
    expect(buildAutomatedProductFilter(rules)).toEqual({ status: 'active', stitchingType: 'unstitched', occasion: 'eid' });
  });

  it('silently skips a mismatched value/operator combination rather than throwing', () => {
    // `priceFils` with `eq` isn't a supported combination (only gte/lte are).
    const rules: CollectionRule[] = [{ field: 'priceFils', operator: 'eq', value: 10_000 }];
    expect(buildAutomatedProductFilter(rules)).toEqual({ status: 'active' });
  });
});
