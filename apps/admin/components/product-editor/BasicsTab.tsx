'use client';

import type { Brand, Category, Collection } from '@lulwah/contracts';
import { Input } from '@lulwah/ui';
import type { ProductDraft } from '../../lib/product-draft';
import { MultiCheckList } from './MultiCheckList';
import { labelClassName, selectClassName, textareaClassName } from './field-styles';

export interface BasicsTabProps {
  draft: ProductDraft;
  onChange: (next: ProductDraft) => void;
  brands: Brand[];
  categories: Category[];
  collections: Collection[];
}

/** plan.md §11.1 Basics tab: title (EN), slug, article code, brand,
 *  categories, collections, description. `titleAr` is present but left
 *  optional/empty — Arabic content is explicitly deferred (plan.md via
 *  `docs/implemented-plan.md` §5.1's "representative message keys only"
 *  stance carried forward here). "Description" maps to `seo.descEn`
 *  (`Product` has no separate top-level description field — see
 *  `product.ts`'s `ProductSeo`). */
export function BasicsTab({ draft, onChange, brands, categories, collections }: BasicsTabProps) {
  const categoryOptions = categories
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((c) => ({ value: c.id, label: c.name, indent: c.level }));
  const collectionOptions = collections.map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="flex flex-col gap-24">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <Input label="Title" value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} />
        <Input
          label="Title (Arabic) — optional"
          value={draft.titleAr}
          onChange={(e) => onChange({ ...draft, titleAr: e.target.value })}
        />
        <Input
          label="Slug — auto-generated from title if left blank"
          value={draft.slug}
          onChange={(e) => onChange({ ...draft, slug: e.target.value })}
        />
        <Input label="Article code" value={draft.articleCode} onChange={(e) => onChange({ ...draft, articleCode: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <label htmlFor="brand-select" className={labelClassName}>
            Brand
          </label>
          <select
            id="brand-select"
            className={selectClassName}
            value={draft.brandId}
            onChange={(e) => onChange({ ...draft, brandId: e.target.value })}
          >
            <option value="">Select a brand…</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-4">
          <label htmlFor="primary-category-select" className={labelClassName}>
            Primary category
          </label>
          <select
            id="primary-category-select"
            className={selectClassName}
            value={draft.primaryCategoryId}
            onChange={(e) => {
              const primaryCategoryId = e.target.value;
              const categoryIds = draft.categoryIds.includes(primaryCategoryId)
                ? draft.categoryIds
                : [...draft.categoryIds, primaryCategoryId].filter(Boolean);
              onChange({ ...draft, primaryCategoryId, categoryIds });
            }}
          >
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.path}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Categories</span>
          <MultiCheckList
            options={categoryOptions}
            selected={draft.categoryIds}
            onChange={(categoryIds) => onChange({ ...draft, categoryIds })}
          />
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Collections</span>
          <MultiCheckList
            options={collectionOptions}
            selected={draft.collectionIds}
            onChange={(collectionIds) => onChange({ ...draft, collectionIds })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <label htmlFor="description" className={labelClassName}>
          Description
        </label>
        <textarea
          id="description"
          className={textareaClassName}
          value={draft.seo.descEn ?? ''}
          onChange={(e) => onChange({ ...draft, seo: { ...draft.seo, descEn: e.target.value } })}
        />
      </div>
    </div>
  );
}
