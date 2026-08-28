'use client';

import { useMemo } from 'react';
import { useAdminCollectionsQuery } from '../../lib/queries/catalog-refs';
import { useAdminProductsQuery } from '../../lib/queries/products';
import { MultiCheckList } from '../product-editor/MultiCheckList';

/**
 * `Discount.excludeIds` (`@lulwah/contracts`' `discount.ts`) is one flat
 * array of ids checked against a line's product/brand/category/collection
 * all at once (`discount-engine.ts#isExcluded`) — it has no `appliesTo`-
 * style type tag of its own. This picker offers the two exclusion types
 * plan.md §11.1 explicitly names ("targets with a product/collection
 * picker") as two `MultiCheckList`s over the same product/collection data
 * `TargetPicker` already fetches, merged into one `excludeIds` array.
 */
export function ExcludePicker({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  const { data: products } = useAdminProductsQuery();
  const { data: collections } = useAdminCollectionsQuery();

  const productIds = useMemo(() => new Set((products ?? []).map((p) => p.id)), [products]);
  const collectionIds = useMemo(() => new Set((collections ?? []).map((c) => c.id)), [collections]);

  const selectedProductIds = selected.filter((id) => productIds.has(id));
  const selectedCollectionIds = selected.filter((id) => collectionIds.has(id));
  // Anything selected that belongs to neither list currently loaded
  // (category/brand ids from an existing discount edited before this
  // picker's precedent existed) is preserved untouched, never silently
  // dropped by a change to either sub-list below.
  const otherSelectedIds = selected.filter((id) => !productIds.has(id) && !collectionIds.has(id));

  return (
    <div className="flex flex-col gap-16">
      <div className="flex flex-col gap-4">
        <span className="text-label font-semibold uppercase tracking-label text-ink-70">Exclude products</span>
        <MultiCheckList
          options={(products ?? []).map((p) => ({ value: p.id, label: `${p.title} (${p.articleCode})` }))}
          selected={selectedProductIds}
          onChange={(next) => onChange([...next, ...selectedCollectionIds, ...otherSelectedIds])}
        />
      </div>
      <div className="flex flex-col gap-4">
        <span className="text-label font-semibold uppercase tracking-label text-ink-70">Exclude collections</span>
        <MultiCheckList
          options={(collections ?? []).map((c) => ({ value: c.id, label: c.name }))}
          selected={selectedCollectionIds}
          onChange={(next) => onChange([...next, ...selectedProductIds, ...otherSelectedIds])}
        />
      </div>
    </div>
  );
}
