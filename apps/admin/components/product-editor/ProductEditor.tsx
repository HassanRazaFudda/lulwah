'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@lulwah/ui';
import { PageHeader } from '../PageHeader';
import { Panel } from '../Panel';
import { ProductStatusPill } from '../ProductStatusPill';
import { Skeleton } from '../Skeleton';
import { useAdminBrandsQuery, useAdminCategoriesQuery, useAdminCollectionsQuery } from '../../lib/queries/catalog-refs';
import { useAdminProductQuery, useCreateProductMutation, useUpdateProductMutation } from '../../lib/queries/products';
import { emptyProductDraft, productToDraft } from '../../lib/product-draft';
import type { ProductDraft } from '../../lib/product-draft';
import { AttributesTab } from './AttributesTab';
import { BasicsTab } from './BasicsTab';
import { EditorTabs } from './EditorTabs';
import type { TabDef } from './EditorTabs';
import { InventoryTab } from './InventoryTab';
import { MediaTab } from './MediaTab';
import { PricingTab } from './PricingTab';
import { PublishingTab } from './PublishingTab';
import { VariantsTab } from './VariantsTab';

type TabId = 'basics' | 'attributes' | 'media' | 'variants' | 'pricing' | 'inventory' | 'publishing';

/**
 * plan.md §11.1's multi-tab product editor, shared by `products/new` and
 * `products/[id]`. Basics/Attributes/Pricing/Publishing edit a local
 * `ProductDraft` (see `lib/product-draft.ts`) that only reaches the API on
 * an explicit Save/Create click — but Media/Variants/Inventory are each
 * independent REST sub-resources (`/variants`, `/media`,
 * `/admin/inventory/.../adjust`) with their own endpoints, so those three
 * write immediately through their own mutations rather than batching into
 * the product PATCH body. Media/Variants/Inventory are disabled until the
 * product has been created once — those endpoints are all nested under
 * `/admin/products/:id/...` and don't exist for a product that has no `id`
 * yet.
 */
export function ProductEditor({ productId }: { productId?: string }) {
  const router = useRouter();
  const isNew = !productId;

  const { data: detail, isLoading: productLoading } = useAdminProductQuery(productId ?? '');
  const { data: brands, isLoading: brandsLoading } = useAdminBrandsQuery();
  const { data: categories, isLoading: categoriesLoading } = useAdminCategoriesQuery();
  const { data: collections } = useAdminCollectionsQuery();

  const createProduct = useCreateProductMutation();
  const updateProduct = useUpdateProductMutation();

  const [activeTab, setActiveTab] = useState<TabId>('basics');
  const [draft, setDraft] = useState<ProductDraft>(() => emptyProductDraft());
  const syncedProductId = useRef<string | null>(null);

  // Sync the draft from server data exactly once per product id — refetches
  // triggered by variant/media/inventory mutations invalidating the product
  // detail query must NOT clobber in-progress edits to Basics/Attributes/
  // Pricing/Publishing fields that haven't been saved yet.
  useEffect(() => {
    if (detail?.product && syncedProductId.current !== detail.product.id) {
      setDraft(productToDraft(detail.product));
      syncedProductId.current = detail.product.id;
    }
  }, [detail]);

  const requiredFieldsMissing =
    draft.title.trim() === '' ||
    draft.articleCode.trim() === '' ||
    draft.brandId === '' ||
    draft.primaryCategoryId === '' ||
    draft.basePriceFils <= 0;

  const handleSave = () => {
    if (isNew) {
      createProduct.mutate(draft, {
        onSuccess: (product) => router.replace(`/products/${product.id}`),
      });
    } else if (productId) {
      updateProduct.mutate({ id: productId, draft });
    }
  };

  const saving = createProduct.isPending || updateProduct.isPending;
  const saveError = createProduct.error ?? updateProduct.error;
  const justSaved = !isNew && updateProduct.isSuccess;

  if (!isNew && productLoading) {
    return (
      <div className="flex flex-col gap-16">
        <Skeleton className="h-[52px]" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!isNew && !detail) {
    return <p className="text-body-sm text-ink-70">Product not found.</p>;
  }

  const tabs: TabDef[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'attributes', label: 'Attributes' },
    { id: 'media', label: 'Media', disabled: isNew },
    { id: 'variants', label: 'Variants', disabled: isNew },
    { id: 'pricing', label: 'Pricing' },
    { id: 'inventory', label: 'Inventory', disabled: isNew },
    { id: 'publishing', label: 'Publishing' },
  ];

  // `exactOptionalPropertyTypes` (plan.md §27.1) rejects an explicit
  // `undefined` for `description` — omit the key entirely rather than pass
  // `detail?.product.articleCode` directly (which types as `string |
  // undefined` even though `detail` is guaranteed defined here whenever
  // `!isNew`, since the early return above already handled the missing-
  // detail case).
  const descriptionProp = isNew
    ? { description: 'Fill in Basics, then save to unlock Media/Variants/Inventory.' }
    : detail
      ? { description: detail.product.articleCode }
      : {};

  return (
    <div className="flex flex-col gap-16">
      <PageHeader
        title={isNew ? 'New product' : draft.title || detail?.product.slug || 'Product'}
        {...descriptionProp}
        actions={
          <div className="flex items-center gap-12">
            {!isNew && detail ? <ProductStatusPill status={detail.product.status} /> : null}
            {justSaved ? <span className="text-body-sm text-success">Saved</span> : null}
            <Button type="button" onClick={handleSave} disabled={saving || requiredFieldsMissing}>
              {saving ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
            </Button>
          </div>
        }
      />

      {requiredFieldsMissing ? (
        <p className="text-body-sm text-ink-70">
          Title, article code, brand, primary category and a base price above zero are required before saving.
        </p>
      ) : null}
      {saveError ? <p className="text-body-sm text-danger">{saveError.message}</p> : null}

      <EditorTabs tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      <Panel>
        {activeTab === 'basics' ? (
          brandsLoading || categoriesLoading ? (
            <Skeleton className="h-[300px]" />
          ) : (
            <BasicsTab draft={draft} onChange={setDraft} brands={brands ?? []} categories={categories ?? []} collections={collections ?? []} />
          )
        ) : null}
        {activeTab === 'attributes' ? <AttributesTab draft={draft} onChange={setDraft} /> : null}
        {activeTab === 'media' && detail ? <MediaTab productId={detail.product.id} media={detail.product.media} /> : null}
        {activeTab === 'variants' && detail ? (
          <VariantsTab
            productId={detail.product.id}
            articleCode={detail.product.articleCode}
            basePriceFils={detail.product.basePriceFils}
            variants={detail.variants}
          />
        ) : null}
        {activeTab === 'pricing' ? <PricingTab draft={draft} onChange={setDraft} /> : null}
        {activeTab === 'inventory' && detail ? <InventoryTab variants={detail.variants} /> : null}
        {activeTab === 'publishing' ? <PublishingTab draft={draft} onChange={setDraft} /> : null}
      </Panel>
    </div>
  );
}
