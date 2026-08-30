'use client';

import { useState } from 'react';
import type { ProductMediaItem } from '@lulwah/contracts';
import { Button, Input } from '@lulwah/ui';
import { resolveAssetUrl } from '../../lib/asset-url';
import { useAddProductMediaMutation } from '../../lib/queries/products';
import { selectClassName } from './field-styles';

/**
 * `POST /admin/products/:id/media` accepts an already-hosted
 * `{ url, alt, isPrimary }` (`AddProductMediaInput` — `product.dto.ts`'s
 * own comment: "plan.md brief: accept an already-hosted URL for now").
 * There is no real upload/S3 pipeline in this phase (confirmed in
 * `docs/implemented-plan.md`), so this tab is deliberately "paste an image
 * URL", not a drag-drop uploader — building a fake uploader against a
 * paste-a-URL endpoint would misrepresent what's actually there.
 *
 * There is also no `PATCH`/`DELETE` route for a single media item (only
 * `POST` to add — see `catalog.routes.ts`), so existing media renders
 * read-only below the add form; there's nothing to wire a remove/reorder
 * action to yet.
 */
export function MediaTab({ productId, media }: { productId: string; media: ProductMediaItem[] }) {
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [isPrimary, setIsPrimary] = useState(media.length === 0);
  const [type, setType] = useState<'image' | 'video'>('image');
  const addMedia = useAddProductMediaMutation(productId);

  const urlError = url.trim() !== '' && !/^https?:\/\//i.test(url.trim()) ? 'Must be a full http(s) URL.' : null;
  const canSubmit = url.trim() !== '' && urlError === null && !addMedia.isPending;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    addMedia.mutate(
      { url: url.trim(), alt: alt.trim(), isPrimary, type },
      { onSuccess: () => { setUrl(''); setAlt(''); setIsPrimary(false); } },
    );
  };

  return (
    <div className="flex flex-col gap-24">
      <form onSubmit={handleSubmit} className="flex flex-col gap-12 border border-line bg-nacre p-16">
        <p className="text-body-sm text-ink-70">Paste a hosted image URL; there is no upload pipeline in this phase.</p>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          <Input label="Image URL" value={url} onChange={(e) => setUrl(e.target.value)} {...(urlError ? { errorMessage: urlError } : {})} />
          <Input label="Alt text" value={alt} onChange={(e) => setAlt(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-16">
          <div className="flex flex-col gap-4">
            <span className="text-label uppercase tracking-label text-ink-70">Type</span>
            <select className={selectClassName} value={type} onChange={(e) => setType(e.target.value as 'image' | 'video')}>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>
          <label className="flex items-center gap-8 text-body-sm text-ink">
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
            Set as primary image
          </label>
        </div>
        {addMedia.isError ? <p className="text-body-sm text-danger">{addMedia.error.message}</p> : null}
        <div>
          <Button type="submit" disabled={!canSubmit}>
            {addMedia.isPending ? 'Adding…' : 'Add media'}
          </Button>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-16 sm:grid-cols-4">
        {media.length === 0 ? <p className="text-body-sm text-ink-70">No media yet.</p> : null}
        {media
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => (
            <figure key={item.id} className="flex flex-col gap-4">
              {/* Plain <img> — no imgproxy loader in local dev (plan.md §8.3); pasted-URL media previews render as-is. */}
              <img src={resolveAssetUrl(item.url)} alt={item.alt} className="aspect-[3/4] w-full border border-line object-cover" />
              <figcaption className="text-body-sm text-ink-70">
                {item.isPrimary ? <span className="font-semibold text-zamurrad">Primary · </span> : null}
                {item.alt || <span className="italic">No alt text</span>}
              </figcaption>
            </figure>
          ))}
      </div>
    </div>
  );
}
