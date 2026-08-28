'use client';

import type { MediaRef } from '@lulwah/contracts';
import { Input } from '@lulwah/ui';

/**
 * A pasted-URL `MediaRef` input, reused across hero/banner/menu-featured/
 * collection-hero media fields. Same "no upload pipeline" reality
 * `product-editor/MediaTab.tsx` already documents — the difference here is
 * `MediaRef.publicId` (`@lulwah/contracts`' `product.ts`) is a *required*
 * string with no server-side default for an inline subdocument (unlike
 * `MediaAsset.publicId`, which `media-asset.service.ts` generates via
 * `randomUUID()` server-side for a real library entry). Since this field is
 * just "paste a hosted image URL" with nothing to derive an id from, the
 * URL itself is reused as `publicId` — stable and unique enough for what
 * is, today, a metadata pointer rather than a real asset record.
 */
export function MediaRefField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MediaRef | null;
  onChange: (next: MediaRef | null) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <Input
        label={`${label} — image URL`}
        value={value?.url ?? ''}
        onChange={(event) => {
          const url = event.target.value.trim();
          onChange(url ? { publicId: url, url } : null);
        }}
      />
      {value?.url ? (
        // Plain <img> — no imgproxy loader in local dev (plan.md §8.3),
        // same precedent `MediaTab.tsx`/`products/page.tsx` already set.
        <img src={value.url} alt="" className="h-[64px] w-[64px] border border-line object-cover" />
      ) : null}
    </div>
  );
}
