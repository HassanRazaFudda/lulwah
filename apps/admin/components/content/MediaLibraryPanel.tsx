'use client';

import { useState } from 'react';
import type { MediaAssetType } from '@lulwah/contracts';
import { Button, Input } from '@lulwah/ui';
import { Skeleton } from '../Skeleton';
import { pushToast } from '../../lib/stores/toast-store';
import {
  useAdminMediaAssetsQuery,
  useAdminMediaFoldersQuery,
  useCreateMediaAssetMutation,
  useBulkUpdateMediaAssetsMutation,
  useDeleteMediaAssetMutation,
} from '../../lib/queries/content-media';
import { labelClassName, selectClassName } from '../product-editor/field-styles';

/**
 * plan.md §11.1: "Media library with folders, search, alt-text bulk edit."
 *
 * This is a metadata layer over already-hosted URLs, not a real
 * upload/S3 pipeline — confirmed by reading `media-asset.service.ts`'s own
 * doc comment (`apps/api/src/modules/content/media-asset.service.ts`), the
 * same "paste-a-URL" reality `product-editor/MediaTab.tsx` already
 * documents for product photography. The "add asset" flow below is
 * therefore a URL-paste form, not a fake drag-drop uploader — there is
 * nowhere for an uploaded file to actually go in this codebase yet.
 */
export function MediaLibraryPanel() {
  const [folder, setFolder] = useState('');
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [type, setType] = useState<MediaAssetType | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filter = {
    folder: folder || undefined,
    search: search.trim() || undefined,
    tag: tag.trim() || undefined,
    type: type === 'all' ? undefined : type,
  };
  const { data: assets, isLoading } = useAdminMediaAssetsQuery(filter);
  const { data: folders } = useAdminMediaFoldersQuery();
  const createAsset = useCreateMediaAssetMutation();
  const bulkUpdate = useBulkUpdateMediaAssetsMutation();
  const deleteAsset = useDeleteMediaAssetMutation();

  const list = assets ?? [];

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [newUrl, setNewUrl] = useState('');
  const [newAlt, setNewAlt] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const [newTags, setNewTags] = useState('');
  const urlValid = /^https?:\/\//i.test(newUrl.trim());

  const handleAdd = () => {
    if (!urlValid) return;
    createAsset.mutate(
      {
        url: newUrl.trim(),
        type: 'image',
        alt: newAlt.trim(),
        altAr: '',
        folder: newFolder.trim(),
        tags: newTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      },
      {
        onSuccess: () => {
          pushToast('success', 'Asset added.');
          setNewUrl('');
          setNewAlt('');
          setNewFolder('');
          setNewTags('');
        },
        onError: (error) => pushToast('error', `Could not add asset: ${error.message}`),
      },
    );
  };

  const [bulkAlt, setBulkAlt] = useState('');
  const [bulkFolder, setBulkFolder] = useState('');
  const [bulkTags, setBulkTags] = useState('');

  const handleBulkApply = () => {
    const updates = [...selected].map((id) => ({
      id,
      ...(bulkAlt.trim() ? { alt: bulkAlt.trim() } : {}),
      ...(bulkFolder.trim() ? { folder: bulkFolder.trim() } : {}),
      ...(bulkTags.trim()
        ? { tags: bulkTags.split(',').map((t) => t.trim()).filter(Boolean) }
        : {}),
    }));
    if (updates.length === 0) return;
    bulkUpdate.mutate(updates, {
      onSuccess: (updated) => {
        pushToast('success', `Updated ${updated.length} asset(s).`);
        setSelected(new Set());
        setBulkAlt('');
        setBulkFolder('');
        setBulkTags('');
      },
      onError: (error) => pushToast('error', `Bulk update failed: ${error.message}`),
    });
  };

  const handleDelete = (id: string, alt: string) => {
    if (!window.confirm(`Remove this media reference (${alt || 'no alt text'})? This does not delete the hosted file.`)) return;
    deleteAsset.mutate(id, {
      onSuccess: () => pushToast('success', 'Asset removed from the library.'),
      onError: (error) => pushToast('error', `Could not remove asset: ${error.message}`),
    });
  };

  return (
    <div className="flex flex-col gap-16">
      <div className="border border-line bg-nacre p-16">
        <h3 className="mb-8 text-body font-semibold text-ink">Add asset: paste a hosted image URL</h3>
        <p className="mb-12 text-body-sm text-ink-70">
          No upload/S3 pipeline exists in this codebase, so this pastes an already-hosted URL into the library's
          metadata (folder, tags, alt text), the same reality `product-editor/MediaTab.tsx` documents for product
          photography.
        </p>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
          <Input label="Image URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <Input label="Alt text (EN)" value={newAlt} onChange={(e) => setNewAlt(e.target.value)} />
          <Input label="Folder (optional)" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
          <Input label="Tags (comma-separated)" value={newTags} onChange={(e) => setNewTags(e.target.value)} />
        </div>
        <div className="mt-12">
          <Button type="button" onClick={handleAdd} disabled={!urlValid || createAsset.isPending}>
            {createAsset.isPending ? 'Adding…' : 'Add asset'}
          </Button>
          {!urlValid && newUrl.trim() !== '' ? <span className="ml-12 text-body-sm text-danger">Must be a full http(s) URL.</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-8">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Folder</span>
          <select className={selectClassName} value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">All folders</option>
            {(folders ?? []).map((f) => (
              <option key={f || '(root)'} value={f}>
                {f || '(root)'}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Type</span>
          <select className={selectClassName} value={type} onChange={(e) => setType(e.target.value as MediaAssetType | 'all')}>
            <option value="all">All types</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>
        <Input label="Search alt text" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Input label="Tag" value={tag} onChange={(e) => setTag(e.target.value)} />
      </div>

      {selected.size > 0 ? (
        <div className="border border-line bg-nacre p-16">
          <h3 className="mb-8 text-body font-semibold text-ink">Bulk edit ({selected.size} selected)</h3>
          <p className="mb-12 text-body-sm text-ink-70">Only fields you fill in below are applied; blank fields are left unchanged.</p>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            <Input label="Alt text (EN)" value={bulkAlt} onChange={(e) => setBulkAlt(e.target.value)} />
            <Input label="Folder" value={bulkFolder} onChange={(e) => setBulkFolder(e.target.value)} />
            <Input label="Tags (comma-separated)" value={bulkTags} onChange={(e) => setBulkTags(e.target.value)} />
          </div>
          <div className="mt-12 flex items-center gap-8">
            <Button type="button" onClick={handleBulkApply} disabled={bulkUpdate.isPending}>
              {bulkUpdate.isPending ? 'Applying…' : `Apply to ${selected.size}`}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-16 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="text-body-sm text-ink-70">No media assets match these filters.</p>
      ) : (
        <div className="grid grid-cols-2 gap-16 sm:grid-cols-4">
          {list.map((asset) => (
            <div key={asset.id} className="flex flex-col gap-4 border border-line bg-paper p-8">
              <label className="flex items-center gap-8 text-body-sm text-ink">
                <input type="checkbox" checked={selected.has(asset.id)} onChange={() => toggleSelected(asset.id)} />
                Select
              </label>
              {/* Plain <img> — no imgproxy loader in local dev (plan.md §8.3). */}
              <img src={asset.url} alt={asset.alt} className="aspect-[3/4] w-full border border-line object-cover" />
              <p className="truncate text-body-sm text-ink">{asset.alt || <span className="italic text-ink-70">No alt text</span>}</p>
              <p className="truncate text-body-sm text-ink-70">{asset.folder || '(root)'}{asset.tags.length > 0 ? ` · ${asset.tags.join(', ')}` : ''}</p>
              <button type="button" className="self-start text-body-sm text-danger hover:underline" onClick={() => handleDelete(asset.id, asset.alt)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
