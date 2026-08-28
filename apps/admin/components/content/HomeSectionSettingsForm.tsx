'use client';

import type { HomeSectionType } from '@lulwah/contracts';
import { Input } from '@lulwah/ui';
import { useAdminBrandsQuery, useAdminCollectionsQuery } from '../../lib/queries/catalog-refs';
import { labelClassName, selectClassName, textareaClassName } from '../product-editor/field-styles';
import { MultiCheckList } from '../product-editor/MultiCheckList';
import { MediaRefField } from './MediaRefField';
import { StringListEditor } from './StringListEditor';

type Settings = Record<string, unknown>;

export interface HomeSectionSettingsFormProps {
  type: HomeSectionType;
  settings: Settings;
  onChange: (next: Settings) => void;
}

/**
 * plan.md §11.1: "each with a typed settings form" — one real sub-form per
 * `HomeSectionType`, driven by the 9 discriminated schemas in
 * `@lulwah/contracts`' `content.ts` (`HOME_SECTION_SETTINGS_SCHEMAS`), not
 * one generic JSON-editor form. Each branch below edits exactly the fields
 * its matching Zod schema declares — cross-checked field-for-field against
 * `content.ts` while writing this, not guessed.
 */
export function HomeSectionSettingsForm({ type, settings, onChange }: HomeSectionSettingsFormProps) {
  const set = (key: string, value: unknown) => onChange({ ...settings, [key]: value });
  const str = (key: string) => (typeof settings[key] === 'string' ? (settings[key] as string) : '');
  const media = (key: string) => (settings[key] as { publicId: string; url: string } | null | undefined) ?? null;

  const { data: brands } = useAdminBrandsQuery();
  const { data: collections } = useAdminCollectionsQuery();

  switch (type) {
    case 'hero':
      return (
        <div className="flex flex-col gap-16">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <Input label="Headline (EN)" value={str('headlineEn')} onChange={(e) => set('headlineEn', e.target.value)} />
            <Input label="Headline (AR)" value={str('headlineAr')} onChange={(e) => set('headlineAr', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <MediaRefField label="Desktop media" value={media('media')} onChange={(v) => set('media', v)} />
            <MediaRefField label="Mobile media" value={media('mediaMobile')} onChange={(v) => set('mediaMobile', v)} />
          </div>
          <Input
            label="Video URL — optional"
            value={str('videoUrl')}
            onChange={(e) => set('videoUrl', e.target.value.trim() || null)}
          />
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <Input label="Link label (EN)" value={str('linkLabelEn')} onChange={(e) => set('linkLabelEn', e.target.value)} />
            <Input label="Link label (AR)" value={str('linkLabelAr')} onChange={(e) => set('linkLabelAr', e.target.value)} />
          </div>
          <Input label="Link href" value={str('linkHref')} onChange={(e) => set('linkHref', e.target.value)} />
          <div className="flex flex-col gap-4">
            <span className={labelClassName}>Links to collection — optional</span>
            <select
              className={selectClassName}
              value={(settings.collectionId as string | null) ?? ''}
              onChange={(e) => set('collectionId', e.target.value || null)}
            >
              <option value="">None</option>
              {(collections ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      );

    case 'collection_rail':
      return (
        <div className="flex flex-col gap-16">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <Input label="Title (EN)" value={str('titleEn')} onChange={(e) => set('titleEn', e.target.value)} />
            <Input label="Title (AR)" value={str('titleAr')} onChange={(e) => set('titleAr', e.target.value)} />
          </div>
          <div className="flex flex-col gap-4">
            <span className={labelClassName}>
              Collection — leave unset to fall back to newest/best-selling products (storefront decides which)
            </span>
            <select
              className={selectClassName}
              value={(settings.collectionId as string | null) ?? ''}
              onChange={(e) => set('collectionId', e.target.value || null)}
            >
              <option value="">None (storefront default)</option>
              {(collections ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <Input
              label="Item limit (1–24)"
              type="number"
              min={1}
              max={24}
              value={typeof settings.limit === 'number' ? settings.limit : 6}
              onChange={(e) => set('limit', Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
            />
            <Input
              label="View-all href — optional"
              value={str('viewAllHref')}
              onChange={(e) => set('viewAllHref', e.target.value.trim() || null)}
            />
          </div>
        </div>
      );

    case 'editorial_split':
      return (
        <div className="flex flex-col gap-16">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <Input label="Title (EN)" value={str('titleEn')} onChange={(e) => set('titleEn', e.target.value)} />
            <Input label="Title (AR)" value={str('titleAr')} onChange={(e) => set('titleAr', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <label className={labelClassName} htmlFor="editorial-body-en">
                Body (EN)
              </label>
              <textarea
                id="editorial-body-en"
                className={textareaClassName}
                value={str('bodyEn')}
                onChange={(e) => set('bodyEn', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-4">
              <label className={labelClassName} htmlFor="editorial-body-ar">
                Body (AR)
              </label>
              <textarea
                id="editorial-body-ar"
                className={textareaClassName}
                value={str('bodyAr')}
                onChange={(e) => set('bodyAr', e.target.value)}
              />
            </div>
          </div>
          <MediaRefField label="Media" value={media('media')} onChange={(v) => set('media', v)} />
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <Input
              label="Link href — optional"
              value={str('linkHref')}
              onChange={(e) => set('linkHref', e.target.value.trim() || null)}
            />
            <div className="flex flex-col gap-4">
              <span className={labelClassName}>Media position</span>
              <select
                className={selectClassName}
                value={(settings.mediaPosition as string) || 'left'}
                onChange={(e) => set('mediaPosition', e.target.value)}
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        </div>
      );

    case 'brand_strip':
      return (
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Brands (marquee order follows selection order below is not preserved — see note)</span>
          <p className="text-body-sm text-ink-70">
            Checklist order is alphabetical, not the storefront render order — `brandIds` is a plain array with no
            separate ordering UI in this pass; reorder by editing the underlying array if a specific sequence matters.
          </p>
          <MultiCheckList
            options={(brands ?? []).map((b) => ({ value: b.id, label: b.name }))}
            selected={(settings.brandIds as string[]) ?? []}
            onChange={(next) => set('brandIds', next)}
          />
        </div>
      );

    case 'category_grid':
      return (
        <div className="flex flex-col gap-16">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <Input label="Title (EN)" value={str('titleEn')} onChange={(e) => set('titleEn', e.target.value)} />
            <Input label="Title (AR)" value={str('titleAr')} onChange={(e) => set('titleAr', e.target.value)} />
          </div>
          <CategoryGridTilesEditor
            tiles={(settings.tiles as CategoryGridTileDraft[]) ?? []}
            onChange={(tiles) => set('tiles', tiles)}
          />
        </div>
      );

    case 'video_banner':
      return (
        <div className="flex flex-col gap-16">
          <MediaRefField label="Media" value={media('media')} onChange={(v) => set('media', v)} />
          <Input
            label="Video URL — optional, overrides the still image on the storefront"
            value={str('videoUrl')}
            onChange={(e) => set('videoUrl', e.target.value.trim() || null)}
          />
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <Input label="Caption (EN)" value={str('captionEn')} onChange={(e) => set('captionEn', e.target.value)} />
            <Input label="Caption (AR)" value={str('captionAr')} onChange={(e) => set('captionAr', e.target.value)} />
          </div>
        </div>
      );

    case 'usp_bar':
      return (
        <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
          <StringListEditor label="Items (EN)" values={(settings.itemsEn as string[]) ?? []} onChange={(v) => set('itemsEn', v)} />
          <StringListEditor label="Items (AR)" values={(settings.itemsAr as string[]) ?? []} onChange={(v) => set('itemsAr', v)} />
        </div>
      );

    case 'journal_teaser':
      return (
        <StringListEditor
          label="Journal post slugs (up to 4) — R2 scope, journal itself doesn't exist yet"
          values={(settings.postSlugs as string[]) ?? []}
          onChange={(v) => set('postSlugs', v)}
          max={4}
        />
      );

    case 'newsletter':
      return (
        <div className="flex flex-col gap-16">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <Input label="Headline (EN)" value={str('headlineEn')} onChange={(e) => set('headlineEn', e.target.value)} />
            <Input label="Headline (AR)" value={str('headlineAr')} onChange={(e) => set('headlineAr', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <Input label="Subtext (EN)" value={str('subtextEn')} onChange={(e) => set('subtextEn', e.target.value)} />
            <Input label="Subtext (AR)" value={str('subtextAr')} onChange={(e) => set('subtextAr', e.target.value)} />
          </div>
        </div>
      );

    default:
      return null;
  }
}

interface CategoryGridTileDraft {
  labelEn: string;
  labelAr: string;
  image: { publicId: string; url: string } | null;
  href: string;
}

function CategoryGridTilesEditor({
  tiles,
  onChange,
}: {
  tiles: CategoryGridTileDraft[];
  onChange: (next: CategoryGridTileDraft[]) => void;
}) {
  const atMax = tiles.length >= 8;
  const update = (index: number, patch: Partial<CategoryGridTileDraft>) =>
    onChange(tiles.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  return (
    <div className="flex flex-col gap-12">
      <span className={labelClassName}>Tiles (up to 8) — "Shop by stitching" / "Shop by occasion"</span>
      {tiles.length === 0 ? <p className="text-body-sm text-ink-70">No tiles yet.</p> : null}
      {tiles.map((tile, index) => (
        <div key={index} className="flex flex-col gap-8 border border-line p-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <Input label="Label (EN)" value={tile.labelEn} onChange={(e) => update(index, { labelEn: e.target.value })} />
            <Input label="Label (AR)" value={tile.labelAr} onChange={(e) => update(index, { labelAr: e.target.value })} />
          </div>
          <Input label="Href" value={tile.href} onChange={(e) => update(index, { href: e.target.value })} />
          <MediaRefField label="Tile image" value={tile.image} onChange={(image) => update(index, { image })} />
          <button
            type="button"
            onClick={() => onChange(tiles.filter((_, i) => i !== index))}
            className="self-start text-body-sm text-danger hover:underline"
          >
            Remove tile
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={atMax}
        onClick={() => onChange([...tiles, { labelEn: '', labelAr: '', image: null, href: '' }])}
        className="self-start text-body-sm font-semibold text-zamurrad hover:underline disabled:cursor-not-allowed disabled:text-ink-70 disabled:no-underline"
      >
        + Add tile {atMax ? '(max 8)' : ''}
      </button>
    </div>
  );
}
