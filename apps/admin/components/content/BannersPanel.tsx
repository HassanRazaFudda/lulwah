'use client';

import { useState } from 'react';
import type { Banner, BannerPlacement } from '@lulwah/contracts';
import { Button, Input } from '@lulwah/ui';
import { Skeleton } from '../Skeleton';
import { TypedConfirmDialog } from '../TypedConfirmDialog';
import { pushToast } from '../../lib/stores/toast-store';
import {
  useAdminBannersQuery,
  useCreateBannerMutation,
  useUpdateBannerMutation,
  useDeleteBannerMutation,
  useToggleBannerActiveMutation,
} from '../../lib/queries/content-banners';
import type { BannerDraft } from '../../lib/queries/content-banners';
import { labelClassName, selectClassName } from '../product-editor/field-styles';
import { MediaRefField } from './MediaRefField';

const PLACEMENTS: BannerPlacement[] = ['announcement', 'homepage_top', 'plp_top', 'cart'];
const PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  announcement: 'Announcement bar',
  homepage_top: 'Homepage top',
  plp_top: 'PLP top',
  cart: 'Cart',
};

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function bannerToDraft(banner: Banner): BannerDraft {
  return {
    placement: banner.placement,
    mediaDesktop: banner.mediaDesktop,
    mediaMobile: banner.mediaMobile,
    link: banner.link,
    textEn: banner.textEn,
    textAr: banner.textAr,
    isActive: banner.isActive,
    startsAt: banner.startsAt ? toDatetimeLocal(new Date(banner.startsAt)) : null,
    endsAt: banner.endsAt ? toDatetimeLocal(new Date(banner.endsAt)) : null,
    sortOrder: banner.sortOrder,
  };
}

function emptyDraft(): BannerDraft {
  return {
    placement: 'homepage_top',
    mediaDesktop: null,
    mediaMobile: null,
    link: null,
    textEn: '',
    textAr: '',
    isActive: true,
    startsAt: null,
    endsAt: null,
    sortOrder: 0,
  };
}

/** plan.md §11.1: "Banners with desktop/mobile assets and scheduling" —
 *  real CRUD against `GET/POST/PATCH/DELETE /admin/content/banners*`. */
export function BannersPanel() {
  const { data: banners, isLoading } = useAdminBannersQuery();
  const createBanner = useCreateBannerMutation();
  const updateBanner = useUpdateBannerMutation();
  const deleteBanner = useDeleteBannerMutation();
  const toggleActive = useToggleBannerActiveMutation();

  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<BannerDraft>(emptyDraft());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const sorted = (banners ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  const startNew = () => {
    setDraft(emptyDraft());
    setEditingId('new');
  };
  const startEdit = (banner: Banner) => {
    setDraft(bannerToDraft(banner));
    setEditingId(banner.id);
  };

  const handleSave = () => {
    if (editingId === 'new') {
      createBanner.mutate(draft, {
        onSuccess: () => {
          pushToast('success', 'Banner created.');
          setEditingId(null);
        },
        onError: (error) => pushToast('error', `Could not create banner: ${error.message}`),
      });
    } else if (editingId) {
      updateBanner.mutate(
        { id: editingId, draft },
        {
          onSuccess: () => {
            pushToast('success', 'Banner saved.');
            setEditingId(null);
          },
          onError: (error) => pushToast('error', `Could not save banner: ${error.message}`),
        },
      );
    }
  };

  const handleDelete = () => {
    if (!pendingDeleteId) return;
    deleteBanner.mutate(pendingDeleteId, {
      onSuccess: () => {
        pushToast('success', 'Banner deleted.');
        setPendingDeleteId(null);
        if (editingId === pendingDeleteId) setEditingId(null);
      },
      onError: (error) => pushToast('error', `Could not delete banner: ${error.message}`),
    });
  };

  const saving = createBanner.isPending || updateBanner.isPending;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[56px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-16">
      <div className="flex justify-end">
        <Button type="button" onClick={startNew}>
          New banner
        </Button>
      </div>

      <div className="flex flex-col gap-8">
        {sorted.length === 0 ? <p className="text-body-sm text-ink-70">No banners yet.</p> : null}
        {sorted.map((banner) => (
          <div key={banner.id} className="border border-line bg-paper">
            <div className="flex flex-wrap items-center gap-12 px-16 py-12">
              <span className="text-body-sm font-semibold text-ink">{PLACEMENT_LABELS[banner.placement]}</span>
              <span className="flex-1 truncate text-body-sm text-ink-70">{banner.textEn || '(no text)'}</span>
              <span className={banner.isActive ? 'text-label uppercase tracking-label text-success' : 'text-label uppercase tracking-label text-ink-70'}>
                {banner.isActive ? 'Active' : 'Inactive'}
              </span>
              <button
                type="button"
                className="text-body-sm text-ink-70 hover:text-ink"
                onClick={() =>
                  toggleActive.mutate(
                    { id: banner.id, isActive: !banner.isActive },
                    { onError: (error) => pushToast('error', `Could not update banner: ${error.message}`) },
                  )
                }
              >
                {banner.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <Button type="button" variant="secondary" onClick={() => startEdit(banner)}>
                Edit
              </Button>
              <button type="button" className="text-body-sm text-danger hover:underline" onClick={() => setPendingDeleteId(banner.id)}>
                Delete
              </button>
            </div>

            {editingId === banner.id ? (
              <div className="border-t border-line p-16">
                <BannerForm draft={draft} onChange={setDraft} />
                {updateBanner.isError ? <p className="mt-8 text-body-sm text-danger">{updateBanner.error.message}</p> : null}
                <div className="mt-16 flex justify-end gap-8">
                  <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save banner'}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {editingId === 'new' ? (
        <div className="border border-line bg-paper p-16">
          <h3 className="mb-16 text-body font-semibold text-ink">New banner</h3>
          <BannerForm draft={draft} onChange={setDraft} />
          {createBanner.isError ? <p className="mt-8 text-body-sm text-danger">{createBanner.error.message}</p> : null}
          <div className="mt-16 flex justify-end gap-8">
            <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Create banner'}
            </Button>
          </div>
        </div>
      ) : null}

      <TypedConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete banner"
        description="This permanently removes the banner. Type DELETE to confirm."
        confirmLabel="DELETE"
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
        isPending={deleteBanner.isPending}
        errorMessage={deleteBanner.isError ? deleteBanner.error.message : null}
      />
    </div>
  );
}

function BannerForm({ draft, onChange }: { draft: BannerDraft; onChange: (next: BannerDraft) => void }) {
  return (
    <div className="flex flex-col gap-16">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Placement</span>
          <select
            className={selectClassName}
            value={draft.placement}
            onChange={(e) => onChange({ ...draft, placement: e.target.value as BannerPlacement })}
          >
            {PLACEMENTS.map((p) => (
              <option key={p} value={p}>
                {PLACEMENT_LABELS[p]}
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
        <Input label="Text (EN)" value={draft.textEn} onChange={(e) => onChange({ ...draft, textEn: e.target.value })} />
        <Input label="Text (AR)" value={draft.textAr} onChange={(e) => onChange({ ...draft, textAr: e.target.value })} />
      </div>
      <Input
        label="Link — optional"
        value={draft.link ?? ''}
        onChange={(e) => onChange({ ...draft, link: e.target.value.trim() || null })}
      />
      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <MediaRefField label="Desktop media" value={draft.mediaDesktop} onChange={(v) => onChange({ ...draft, mediaDesktop: v })} />
        <MediaRefField label="Mobile media" value={draft.mediaMobile} onChange={(v) => onChange({ ...draft, mediaMobile: v })} />
      </div>
      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Starts at — optional</span>
          <input
            type="datetime-local"
            className={selectClassName}
            value={draft.startsAt ?? ''}
            onChange={(e) => onChange({ ...draft, startsAt: e.target.value || null })}
          />
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Ends at — optional</span>
          <input
            type="datetime-local"
            className={selectClassName}
            value={draft.endsAt ?? ''}
            onChange={(e) => onChange({ ...draft, endsAt: e.target.value || null })}
          />
        </div>
      </div>
      <label className="flex items-center gap-8 text-body-sm text-ink">
        <input type="checkbox" checked={draft.isActive} onChange={(e) => onChange({ ...draft, isActive: e.target.checked })} />
        Active
      </label>
    </div>
  );
}
