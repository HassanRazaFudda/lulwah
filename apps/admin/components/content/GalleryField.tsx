'use client';

import type { MediaRef } from '@lulwah/contracts';
import { MediaRefField } from './MediaRefField';
import { labelClassName } from '../product-editor/field-styles';

/**
 * A plain add/remove list of `MediaRefField`s for `Lookbook.gallery:
 * MediaRef[]` — the same "no drag library dependency, no upload pipeline"
 * posture `HomeSectionSettingsForm.tsx`'s `CategoryGridTilesEditor` already
 * establishes for its own `MediaRef`-bearing array field (`tiles`), stripped
 * down to just the media picker since a gallery entry is nothing but a
 * `MediaRef` (no label/href to also collect, per `content.ts`'s
 * `Lookbook.gallery` field — plain `MediaRef[]`, not `CategoryGridTile[]`).
 *
 * An item cleared back to an empty URL is dropped from the list outright
 * (via `MediaRefField`'s own `null` callback) rather than left behind as a
 * blank placeholder entry — `LookbooksPanel.tsx` still filters empty
 * entries again just before submit as a second line of defence, since a
 * freshly-added-but-never-filled-in slot never goes through this callback
 * at all.
 */
export function GalleryField({
  label,
  value,
  onChange,
  max = 20,
}: {
  label: string;
  value: MediaRef[];
  onChange: (next: MediaRef[]) => void;
  max?: number;
}) {
  const atMax = value.length >= max;

  const updateItem = (index: number, next: MediaRef | null) => {
    if (next === null) {
      onChange(value.filter((_, i) => i !== index));
    } else {
      onChange(value.map((item, i) => (i === index ? next : item)));
    }
  };

  return (
    <div className="flex flex-col gap-12">
      <span className={labelClassName}>
        {label} ({value.length}/{max})
      </span>
      {value.length === 0 ? <p className="text-body-sm text-ink-70">No images yet.</p> : null}
      <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 md:grid-cols-3">
        {value.map((item, index) => (
          <div key={index} className="flex flex-col gap-8 border border-line p-12">
            <MediaRefField label={`Image ${index + 1}`} value={item} onChange={(next) => updateItem(index, next)} />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              className="self-start text-body-sm text-danger hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={atMax}
        onClick={() => onChange([...value, { publicId: '', url: '' }])}
        className="self-start text-body-sm font-semibold text-zamurrad hover:underline disabled:cursor-not-allowed disabled:text-ink-70 disabled:no-underline"
      >
        + Add image {atMax ? `(max ${max})` : ''}
      </button>
    </div>
  );
}
