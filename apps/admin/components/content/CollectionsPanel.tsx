'use client';

import { useState } from 'react';
import type { DragEvent } from 'react';
import type { Collection, CollectionLayout, CollectionStatus, CollectionType } from '@lulwah/contracts';
import { Button, Input } from '@lulwah/ui';
import { Skeleton } from '../Skeleton';
import { TypedConfirmDialog } from '../TypedConfirmDialog';
import { pushToast } from '../../lib/stores/toast-store';
import { useAdminBrandsQuery } from '../../lib/queries/catalog-refs';
import { useAdminProductsQuery } from '../../lib/queries/products';
import {
  useAdminCollectionsQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
} from '../../lib/queries/collections';
import type { CollectionDraft } from '../../lib/queries/collections';
import { moveItem } from '../../lib/array-utils';
import { labelClassName, selectClassName, textareaClassName } from '../product-editor/field-styles';
import { MediaRefField } from './MediaRefField';
import { CollectionRuleBuilder } from './CollectionRuleBuilder';

const TYPES: CollectionType[] = ['seasonal', 'brand', 'editorial', 'sale', 'automated'];
const STATUSES: CollectionStatus[] = ['draft', 'scheduled', 'active', 'ended'];
const LAYOUTS: CollectionLayout[] = ['grid', 'editorial', 'lookbook', 'split'];

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function collectionToDraft(c: Collection): CollectionDraft {
  return {
    name: c.name,
    nameAr: c.nameAr,
    slug: c.slug,
    subtitle: c.subtitle,
    descriptionEn: c.descriptionEn,
    descriptionAr: c.descriptionAr,
    brandId: c.brandId,
    type: c.type,
    rules: c.rules,
    productIds: c.productIds,
    heroImage: c.heroImage,
    heroImageMobile: c.heroImageMobile,
    launchAt: c.launchAt ? toDatetimeLocal(new Date(c.launchAt)) : null,
    endAt: c.endAt ? toDatetimeLocal(new Date(c.endAt)) : null,
    isTeaserVisible: c.isTeaserVisible,
    status: c.status,
    layout: c.layout,
    sortOrder: c.sortOrder,
    isFeatured: c.isFeatured,
  };
}

function emptyDraft(): CollectionDraft {
  return {
    name: '',
    nameAr: '',
    subtitle: '',
    descriptionEn: '',
    descriptionAr: '',
    brandId: null,
    type: 'seasonal',
    rules: [],
    productIds: [],
    heroImage: null,
    heroImageMobile: null,
    launchAt: null,
    endAt: null,
    isTeaserVisible: false,
    status: 'draft',
    layout: 'grid',
    sortOrder: 0,
    isFeatured: false,
  };
}

/**
 * plan.md §11.1: "Collections — manual ordering by drag, or rule builder
 * for automated collections, hero media, layout template, launch
 * scheduler with countdown toggle." Per this task's brief, `Collection`
 * did NOT get a second, parallel model under `content` — it's the
 * pre-existing `catalog` module's `Collection` (already used read-only by
 * the product editor's Basics tab, `lib/queries/catalog-refs.ts`), extended
 * in this phase with `type: 'automated'` + `rules[]` + `heroImageMobile` +
 * `isTeaserVisible`. There was NO admin UI anywhere for Collections before
 * this task (confirmed by search — the only prior consumer was that
 * read-only product-tagging checklist), so this is a new, minimal-but-real
 * screen: full CRUD, the rule builder for `type: 'automated'`, and
 * drag-to-reorder `productIds` for a manually-curated one.
 */
export function CollectionsPanel() {
  const { data: collections, isLoading } = useAdminCollectionsQuery();
  const { data: brands } = useAdminBrandsQuery();
  const { data: products } = useAdminProductsQuery();
  const createCollection = useCreateCollectionMutation();
  const updateCollection = useUpdateCollectionMutation();
  const deleteCollection = useDeleteCollectionMutation();

  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<CollectionDraft>(emptyDraft());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [productPickerId, setProductPickerId] = useState('');

  const list = (collections ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const titleById = new Map((products ?? []).map((p) => [p.id, p.title]));

  const startNew = () => {
    setDraft(emptyDraft());
    setEditingId('new');
  };
  const startEdit = (c: Collection) => {
    setDraft(collectionToDraft(c));
    setEditingId(c.id);
  };

  const handleSave = () => {
    if (editingId === 'new') {
      createCollection.mutate(draft, {
        onSuccess: () => {
          pushToast('success', 'Collection created.');
          setEditingId(null);
        },
        onError: (error) => pushToast('error', `Could not create collection: ${error.message}`),
      });
    } else if (editingId) {
      updateCollection.mutate(
        { id: editingId, draft },
        {
          onSuccess: () => {
            pushToast('success', 'Collection saved.');
            setEditingId(null);
          },
          onError: (error) => pushToast('error', `Could not save collection: ${error.message}`),
        },
      );
    }
  };

  const handleDelete = () => {
    if (!pendingDeleteId) return;
    deleteCollection.mutate(pendingDeleteId, {
      onSuccess: () => {
        pushToast('success', 'Collection deleted.');
        setPendingDeleteId(null);
        if (editingId === pendingDeleteId) setEditingId(null);
      },
      onError: (error) => pushToast('error', `Could not delete collection: ${error.message}`),
    });
  };

  const saving = createCollection.isPending || updateCollection.isPending;
  const pendingDeleteCollection = list.find((c) => c.id === pendingDeleteId) ?? null;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[48px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-16">
      <div className="flex justify-end">
        <Button type="button" onClick={startNew}>
          New collection
        </Button>
      </div>

      <div className="flex flex-col gap-8">
        {list.length === 0 ? <p className="text-body-sm text-ink-70">No collections yet.</p> : null}
        {list.map((c) => (
          <div key={c.id} className="border border-line bg-paper">
            <div className="flex flex-wrap items-center gap-12 px-16 py-12">
              <span className="text-body-sm font-semibold text-ink">{c.name}</span>
              <span className="text-body-sm text-ink-70">{c.type}{c.type === 'automated' ? ` · ${c.rules.length} rule(s)` : ` · ${c.productIds.length} product(s)`}</span>
              <span className="text-label uppercase tracking-label text-ink-70">{c.status}</span>
              {c.isTeaserVisible && c.launchAt ? (
                <span className="text-label uppercase tracking-label text-gold-dark">Countdown on</span>
              ) : null}
              <div className="flex-1" />
              <Button type="button" variant="secondary" onClick={() => startEdit(c)}>
                Edit
              </Button>
              <button type="button" className="text-body-sm text-danger hover:underline" onClick={() => setPendingDeleteId(c.id)}>
                Delete
              </button>
            </div>

            {editingId === c.id ? (
              <div className="border-t border-line p-16">
                <CollectionForm
                  draft={draft}
                  onChange={setDraft}
                  brands={brands ?? []}
                  titleById={titleById}
                  productPickerId={productPickerId}
                  onProductPickerIdChange={setProductPickerId}
                  dragIndex={dragIndex}
                  onDragIndex={setDragIndex}
                />
                {updateCollection.isError ? <p className="mt-8 text-body-sm text-danger">{updateCollection.error.message}</p> : null}
                <div className="mt-16 flex justify-end gap-8">
                  <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save collection'}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {editingId === 'new' ? (
        <div className="border border-line bg-paper p-16">
          <h3 className="mb-16 text-body font-semibold text-ink">New collection</h3>
          <CollectionForm
            draft={draft}
            onChange={setDraft}
            brands={brands ?? []}
            titleById={titleById}
            productPickerId={productPickerId}
            onProductPickerIdChange={setProductPickerId}
            dragIndex={dragIndex}
            onDragIndex={setDragIndex}
          />
          {createCollection.isError ? <p className="mt-8 text-body-sm text-danger">{createCollection.error.message}</p> : null}
          <div className="mt-16 flex justify-end gap-8">
            <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Create collection'}
            </Button>
          </div>
        </div>
      ) : null}

      <TypedConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete collection"
        description="This permanently removes the collection. Type the collection's name to confirm."
        confirmLabel={pendingDeleteCollection?.name ?? ''}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
        isPending={deleteCollection.isPending}
        errorMessage={deleteCollection.isError ? deleteCollection.error.message : null}
      />
    </div>
  );
}

interface CollectionFormProps {
  draft: CollectionDraft;
  onChange: (next: CollectionDraft) => void;
  brands: { id: string; name: string }[];
  titleById: Map<string, string>;
  productPickerId: string;
  onProductPickerIdChange: (id: string) => void;
  dragIndex: number | null;
  onDragIndex: (index: number | null) => void;
}

function CollectionForm({
  draft,
  onChange,
  brands,
  titleById,
  productPickerId,
  onProductPickerIdChange,
  dragIndex,
  onDragIndex,
}: CollectionFormProps) {
  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null) return;
    onChange({ ...draft, productIds: moveItem(draft.productIds, dragIndex, targetIndex) });
    onDragIndex(null);
  };

  return (
    <div className="flex flex-col gap-16">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
        <Input label="Name" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
        <Input label="Name (AR)" value={draft.nameAr} onChange={(e) => onChange({ ...draft, nameAr: e.target.value })} />
        <Input
          label="Slug — auto if left blank on create"
          value={draft.slug ?? ''}
          onChange={(e) => onChange({ ...draft, slug: e.target.value })}
        />
      </div>
      <Input label="Subtitle" value={draft.subtitle} onChange={(e) => onChange({ ...draft, subtitle: e.target.value })} />
      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <label className={labelClassName} htmlFor="collection-desc-en">
            Description (EN)
          </label>
          <textarea
            id="collection-desc-en"
            className={textareaClassName}
            value={draft.descriptionEn}
            onChange={(e) => onChange({ ...draft, descriptionEn: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-4">
          <label className={labelClassName} htmlFor="collection-desc-ar">
            Description (AR)
          </label>
          <textarea
            id="collection-desc-ar"
            className={textareaClassName}
            value={draft.descriptionAr}
            onChange={(e) => onChange({ ...draft, descriptionAr: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-4">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Type</span>
          <select className={selectClassName} value={draft.type} onChange={(e) => onChange({ ...draft, type: e.target.value as CollectionType })}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Status</span>
          <select className={selectClassName} value={draft.status} onChange={(e) => onChange({ ...draft, status: e.target.value as CollectionStatus })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Layout</span>
          <select className={selectClassName} value={draft.layout} onChange={(e) => onChange({ ...draft, layout: e.target.value as CollectionLayout })}>
            {LAYOUTS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Brand — optional (house edit if unset)</span>
          <select className={selectClassName} value={draft.brandId ?? ''} onChange={(e) => onChange({ ...draft, brandId: e.target.value || null })}>
            <option value="">None</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <MediaRefField label="Hero image" value={draft.heroImage} onChange={(v) => onChange({ ...draft, heroImage: v })} />
        <MediaRefField label="Hero image (mobile)" value={draft.heroImageMobile} onChange={(v) => onChange({ ...draft, heroImageMobile: v })} />
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Launch at — optional</span>
          <input
            type="datetime-local"
            className={selectClassName}
            value={draft.launchAt ?? ''}
            onChange={(e) => onChange({ ...draft, launchAt: e.target.value || null })}
          />
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>End at — optional</span>
          <input
            type="datetime-local"
            className={selectClassName}
            value={draft.endAt ?? ''}
            onChange={(e) => onChange({ ...draft, endAt: e.target.value || null })}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-16">
        <label className="flex items-center gap-8 text-body-sm text-ink">
          <input
            type="checkbox"
            checked={draft.isTeaserVisible}
            onChange={(e) => onChange({ ...draft, isTeaserVisible: e.target.checked })}
          />
          Show countdown teaser before launch
        </label>
        <label className="flex items-center gap-8 text-body-sm text-ink">
          <input type="checkbox" checked={draft.isFeatured} onChange={(e) => onChange({ ...draft, isFeatured: e.target.checked })} />
          Featured
        </label>
      </div>

      {draft.type === 'automated' ? (
        <CollectionRuleBuilder rules={draft.rules} onChange={(rules) => onChange({ ...draft, rules })} />
      ) : (
        <div className="flex flex-col gap-8">
          <span className={labelClassName}>Products — manual order (drag to reorder)</span>
          <div className="flex items-center gap-8">
            <select className={selectClassName} value={productPickerId} onChange={(e) => onProductPickerIdChange(e.target.value)}>
              <option value="">Select a product to add…</option>
              {[...titleById.entries()]
                .filter(([id]) => !draft.productIds.includes(id))
                .map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              disabled={!productPickerId}
              onClick={() => {
                if (!productPickerId) return;
                onChange({ ...draft, productIds: [...draft.productIds, productPickerId] });
                onProductPickerIdChange('');
              }}
            >
              Add
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            {draft.productIds.length === 0 ? <p className="text-body-sm text-ink-70">No products added yet.</p> : null}
            {draft.productIds.map((id, index) => (
              <div
                key={id}
                draggable
                onDragStart={() => onDragIndex(index)}
                onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                onDrop={() => handleDrop(index)}
                className="flex cursor-grab items-center gap-8 border border-line bg-nacre px-12 py-8 active:cursor-grabbing"
              >
                <span className="text-ink-70" aria-hidden="true">
                  ⠿
                </span>
                <span className="flex-1 text-body-sm text-ink">{titleById.get(id) ?? id}</span>
                <button
                  type="button"
                  className="text-body-sm text-danger hover:underline"
                  onClick={() => onChange({ ...draft, productIds: draft.productIds.filter((pid) => pid !== id) })}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
