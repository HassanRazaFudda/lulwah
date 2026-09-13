'use client';

import { useState } from 'react';
import type { Collection, Lookbook, LookbookStatus } from '@lulwah/contracts';
import { Button, Input } from '@lulwah/ui';
import { Skeleton } from '../Skeleton';
import { TypedConfirmDialog } from '../TypedConfirmDialog';
import { pushToast } from '../../lib/stores/toast-store';
import {
  useAdminLookbooksQuery,
  useAdminCollectionsQuery,
  useCreateLookbookMutation,
  useUpdateLookbookMutation,
  useDeleteLookbookMutation,
} from '../../lib/queries/content-lookbooks';
import type { LookbookDraft } from '../../lib/queries/content-lookbooks';
import { labelClassName, selectClassName, textareaClassName } from '../product-editor/field-styles';
import { MediaRefField } from './MediaRefField';
import { GalleryField } from './GalleryField';

function lookbookToDraft(lookbook: Lookbook): LookbookDraft {
  return {
    slug: lookbook.slug,
    titleEn: lookbook.titleEn,
    titleAr: lookbook.titleAr,
    heroMedia: lookbook.heroMedia,
    heroMediaMobile: lookbook.heroMediaMobile,
    gallery: lookbook.gallery,
    bodyEn: lookbook.bodyEn,
    bodyAr: lookbook.bodyAr,
    collectionId: lookbook.collectionId,
    status: lookbook.status,
    seo: lookbook.seo,
    sortOrder: lookbook.sortOrder,
  };
}

function emptyDraft(): LookbookDraft {
  return {
    slug: '',
    titleEn: '',
    titleAr: '',
    heroMedia: null,
    heroMediaMobile: null,
    gallery: [],
    bodyEn: '',
    bodyAr: '',
    collectionId: null,
    status: 'draft',
    seo: {},
    sortOrder: 0,
  };
}

/**
 * P4 — editorial Lookbook galleries (`@lulwah/contracts`' `content.ts`:
 * "the standalone editorial-gallery entity... `collectionId` is the
 * optional 'shop this look' tie-in back to a real Collection"). Same real
 * CRUD pattern `PagesPanel.tsx` established (`Page` is the closest
 * structural match: slug, bilingual title, sanitized HTML body via a plain
 * textarea — no WYSIWYG dependency anywhere in this app, SEO fields,
 * draft/published status), plus the extra fields `Lookbook` declares on
 * top of that: hero/hero-mobile media (`MediaRefField`, reused verbatim,
 * not rebuilt), an ordered `gallery: MediaRef[]` (`GalleryField`,
 * following `HomeSectionSettingsForm.tsx`'s `CategoryGridTilesEditor`
 * add/remove-list precedent for a `MediaRef`-bearing array), and an
 * optional "shop this look" `collectionId` picked from the same
 * `useAdminCollectionsQuery()` reference list `HomeSectionSettingsForm.tsx`
 * already uses for its own collection pickers.
 */
export function LookbooksPanel() {
  const { data: lookbooks, isLoading } = useAdminLookbooksQuery();
  const { data: collections } = useAdminCollectionsQuery();
  const createLookbook = useCreateLookbookMutation();
  const updateLookbook = useUpdateLookbookMutation();
  const deleteLookbook = useDeleteLookbookMutation();

  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<LookbookDraft>(emptyDraft());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const list = (lookbooks ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  const startNew = () => {
    setDraft(emptyDraft());
    setEditingId('new');
  };
  const startEdit = (lookbook: Lookbook) => {
    setDraft(lookbookToDraft(lookbook));
    setEditingId(lookbook.id);
  };

  /** Drops any gallery slot never filled in (added via "+ Add image" then
   *  left blank) before it ever reaches the API — `GalleryField`'s own doc
   *  comment covers the first line of defence; this is the second. */
  const buildPayload = (source: LookbookDraft): LookbookDraft => ({
    ...source,
    gallery: source.gallery.filter((item) => item.url.trim() !== ''),
  });

  const handleSave = () => {
    const payload = buildPayload(draft);
    if (editingId === 'new') {
      createLookbook.mutate(payload, {
        onSuccess: () => {
          pushToast('success', 'Lookbook created.');
          setEditingId(null);
        },
        onError: (error) => pushToast('error', `Could not create lookbook: ${error.message}`),
      });
    } else if (editingId) {
      updateLookbook.mutate(
        { id: editingId, draft: payload },
        {
          onSuccess: () => {
            pushToast('success', 'Lookbook saved.');
            setEditingId(null);
          },
          onError: (error) => pushToast('error', `Could not save lookbook: ${error.message}`),
        },
      );
    }
  };

  const handleDelete = () => {
    if (!pendingDeleteId) return;
    deleteLookbook.mutate(pendingDeleteId, {
      onSuccess: () => {
        pushToast('success', 'Lookbook deleted.');
        setPendingDeleteId(null);
        if (editingId === pendingDeleteId) setEditingId(null);
      },
      onError: (error) => pushToast('error', `Could not delete lookbook: ${error.message}`),
    });
  };

  const saving = createLookbook.isPending || updateLookbook.isPending;
  const pendingDeleteLookbook = list.find((l) => l.id === pendingDeleteId) ?? null;

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
          New lookbook
        </Button>
      </div>

      <div className="flex flex-col gap-8">
        {list.length === 0 ? <p className="text-body-sm text-ink-70">No lookbooks yet.</p> : null}
        {list.map((lookbook) => (
          <div key={lookbook.id} className="border border-line bg-paper">
            <div className="flex flex-wrap items-center gap-12 px-16 py-12">
              <span className="text-body-sm font-semibold text-ink">{lookbook.titleEn || '(untitled)'}</span>
              <span className="text-body-sm text-ink-70">/{lookbook.slug}</span>
              <span className="text-body-sm text-ink-70">
                {lookbook.gallery.length} image{lookbook.gallery.length === 1 ? '' : 's'}
              </span>
              <span
                className={
                  lookbook.status === 'published'
                    ? 'text-label uppercase tracking-label text-success'
                    : 'text-label uppercase tracking-label text-ink-70'
                }
              >
                {lookbook.status}
              </span>
              <div className="flex-1" />
              <Button type="button" variant="secondary" onClick={() => startEdit(lookbook)}>
                Edit
              </Button>
              <button
                type="button"
                className="text-body-sm text-danger hover:underline"
                onClick={() => setPendingDeleteId(lookbook.id)}
              >
                Delete
              </button>
            </div>

            {editingId === lookbook.id ? (
              <div className="border-t border-line p-16">
                <LookbookForm draft={draft} onChange={setDraft} collections={collections ?? []} />
                {updateLookbook.isError ? (
                  <p className="mt-8 text-body-sm text-danger">{updateLookbook.error.message}</p>
                ) : null}
                <div className="mt-16 flex justify-end gap-8">
                  <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save lookbook'}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {editingId === 'new' ? (
        <div className="border border-line bg-paper p-16">
          <h3 className="mb-16 text-body font-semibold text-ink">New lookbook</h3>
          <LookbookForm draft={draft} onChange={setDraft} collections={collections ?? []} />
          {createLookbook.isError ? <p className="mt-8 text-body-sm text-danger">{createLookbook.error.message}</p> : null}
          <div className="mt-16 flex justify-end gap-8">
            <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Create lookbook'}
            </Button>
          </div>
        </div>
      ) : null}

      <TypedConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete lookbook"
        description="This permanently removes the lookbook. Type the lookbook's slug to confirm."
        confirmLabel={pendingDeleteLookbook?.slug ?? ''}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
        isPending={deleteLookbook.isPending}
        errorMessage={deleteLookbook.isError ? deleteLookbook.error.message : null}
      />
    </div>
  );
}

function LookbookForm({
  draft,
  onChange,
  collections,
}: {
  draft: LookbookDraft;
  onChange: (next: LookbookDraft) => void;
  collections: Collection[];
}) {
  return (
    <div className="flex flex-col gap-16">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
        <Input label="Title (EN)" value={draft.titleEn} onChange={(e) => onChange({ ...draft, titleEn: e.target.value })} />
        <Input label="Title (AR)" value={draft.titleAr} onChange={(e) => onChange({ ...draft, titleAr: e.target.value })} />
        <Input
          label="Slug (auto if left blank on create)"
          value={draft.slug}
          onChange={(e) => onChange({ ...draft, slug: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <MediaRefField label="Hero media" value={draft.heroMedia} onChange={(v) => onChange({ ...draft, heroMedia: v })} />
        <MediaRefField
          label="Hero media (mobile)"
          value={draft.heroMediaMobile}
          onChange={(v) => onChange({ ...draft, heroMediaMobile: v })}
        />
      </div>

      <GalleryField label="Gallery" value={draft.gallery} onChange={(gallery) => onChange({ ...draft, gallery })} />

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <label className={labelClassName} htmlFor="lookbook-body-en">
            Body (EN): HTML, sanitized server-side; no WYSIWYG toolbar in this pass
          </label>
          <textarea
            id="lookbook-body-en"
            className={textareaClassName + ' min-h-[160px] font-mono text-body-sm'}
            value={draft.bodyEn}
            onChange={(e) => onChange({ ...draft, bodyEn: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-4">
          <label className={labelClassName} htmlFor="lookbook-body-ar">
            Body (AR)
          </label>
          <textarea
            id="lookbook-body-ar"
            className={textareaClassName + ' min-h-[160px] font-mono text-body-sm'}
            value={draft.bodyAr}
            onChange={(e) => onChange({ ...draft, bodyAr: e.target.value })}
            dir="rtl"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Status</span>
          <select
            className={selectClassName}
            value={draft.status}
            onChange={(e) => onChange({ ...draft, status: e.target.value as LookbookStatus })}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Shop this look (optional)</span>
          <select
            className={selectClassName}
            value={draft.collectionId ?? ''}
            onChange={(e) => onChange({ ...draft, collectionId: e.target.value || null })}
          >
            <option value="">None</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Sort order"
          type="number"
          value={draft.sortOrder}
          onChange={(e) => onChange({ ...draft, sortOrder: Number(e.target.value) || 0 })}
        />
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <Input
          label="SEO title (EN, optional)"
          value={draft.seo.titleEn ?? ''}
          onChange={(e) => onChange({ ...draft, seo: { ...draft.seo, titleEn: e.target.value } })}
        />
        <Input
          label="SEO description (EN, optional)"
          value={draft.seo.descEn ?? ''}
          onChange={(e) => onChange({ ...draft, seo: { ...draft.seo, descEn: e.target.value } })}
        />
      </div>
    </div>
  );
}
