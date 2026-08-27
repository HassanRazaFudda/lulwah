import type { CollectionRule } from '@lulwah/contracts';
import type { ProductListFilter } from './product.repository.js';

/**
 * Translates a `type: 'automated'` collection's `rules[]` (plan.md §7.9)
 * into `product.repository.ts`'s existing `ProductListFilter` — reusing the
 * exact facet-filtering machinery `GET /products` already exercises (plan.md
 * §4.4/§7.14) rather than building a second, parallel query builder.
 *
 * Deliberately narrower than the plan's literal `operator` set: the
 * underlying `ProductListFilter` only supports one equality-ish value per
 * field (it powers a single PLP facet click, not an arbitrary query), so
 * `in`/`contains` degenerate to "first value" and unsupported field/operator
 * combinations are silently skipped rather than thrown — an admin building a
 * bad rule gets an empty/partial match, never a 500. Genuinely richer
 * matching (multi-value OR, AND-of-many) is future work, not this pass's.
 */
export function buildAutomatedProductFilter(rules: readonly CollectionRule[]): ProductListFilter {
  const filter: ProductListFilter = { status: 'active' };

  for (const rule of rules) {
    const firstValue = Array.isArray(rule.value) ? rule.value[0] : rule.value;
    switch (rule.field) {
      case 'brandId':
        if (typeof firstValue === 'string') filter.brandId = firstValue;
        break;
      case 'categoryId':
        if (typeof firstValue === 'string') filter.categoryId = firstValue;
        break;
      case 'stitchingType':
        if (typeof firstValue === 'string') filter.stitchingType = firstValue;
        break;
      case 'fabric':
        if (typeof firstValue === 'string') filter.fabric = firstValue;
        break;
      case 'work':
        if (typeof firstValue === 'string') filter.work = firstValue;
        break;
      case 'occasion':
        if (typeof firstValue === 'string') filter.occasion = firstValue;
        break;
      case 'colorFamily':
        if (typeof firstValue === 'string') filter.colorFamily = firstValue;
        break;
      case 'onSale':
        if (typeof firstValue === 'boolean') filter.onSale = firstValue;
        break;
      case 'inStock':
        if (typeof firstValue === 'boolean') filter.inStock = firstValue;
        break;
      case 'priceFils':
        if (typeof firstValue === 'number') {
          if (rule.operator === 'gte') filter.minPriceFils = firstValue;
          if (rule.operator === 'lte') filter.maxPriceFils = firstValue;
        }
        break;
      default:
        break;
    }
  }

  return filter;
}
