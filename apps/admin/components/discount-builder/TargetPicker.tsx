'use client';

import type { DiscountAppliesTo } from '@lulwah/contracts';
import { useAdminBrandsQuery, useAdminCategoriesQuery, useAdminCollectionsQuery } from '../../lib/queries/catalog-refs';
import { useAdminProductsQuery } from '../../lib/queries/products';
import { MultiCheckList } from '../product-editor/MultiCheckList';
import type { MultiCheckOption } from '../product-editor/MultiCheckList';

/**
 * Reuses the product editor's existing category/collection/product
 * selection pattern (`MultiCheckList` + `queries/catalog-refs.ts` +
 * `queries/products.ts`) rather than inventing a new picker — per this
 * task's explicit instruction. Renders the one option list that matches
 * `Discount.appliesTo` (plan.md §11.1: "targets with a product/collection
 * picker" — the contract's `DiscountAppliesTo` also allows `categories`/
 * `brands`, both wired here too since `discount-engine.ts#matchesTarget`
 * genuinely branches on all four, not just the two the plan's prose
 * names).
 */
export function TargetPicker({
  appliesTo,
  selected,
  onChange,
}: {
  appliesTo: DiscountAppliesTo;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { data: products, isLoading: productsLoading } = useAdminProductsQuery();
  const { data: categories, isLoading: categoriesLoading } = useAdminCategoriesQuery();
  const { data: collections, isLoading: collectionsLoading } = useAdminCollectionsQuery();
  const { data: brands, isLoading: brandsLoading } = useAdminBrandsQuery();

  if (appliesTo === 'all') {
    return <p className="text-body-sm text-ink-70">Applies to every product in the catalogue — no target selection needed.</p>;
  }

  const byAppliesTo: Record<Exclude<DiscountAppliesTo, 'all'>, { loading: boolean; options: MultiCheckOption[] }> = {
    products: {
      loading: productsLoading,
      options: (products ?? []).map((p) => ({ value: p.id, label: `${p.title} (${p.articleCode})` })),
    },
    categories: {
      loading: categoriesLoading,
      options: (categories ?? [])
        .slice()
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((c) => ({ value: c.id, label: c.name, indent: c.level })),
    },
    collections: {
      loading: collectionsLoading,
      options: (collections ?? []).map((c) => ({ value: c.id, label: c.name })),
    },
    brands: {
      loading: brandsLoading,
      options: (brands ?? []).map((b) => ({ value: b.id, label: b.name })),
    },
  };
  const { loading, options } = byAppliesTo[appliesTo];

  return (
    <div className="flex flex-col gap-4">
      {loading ? <p className="text-body-sm text-ink-70">Loading…</p> : <MultiCheckList options={options} selected={selected} onChange={onChange} />}
    </div>
  );
}
