import {
  HOME_SECTION_SETTINGS_SCHEMAS,
  type BrandStripSectionSettings,
  type CategoryGridSectionSettings,
  type CollectionRailSectionSettings,
  type EditorialSplitSectionSettings,
  type HeroSectionSettings,
  type HomeSectionType,
  type JournalTeaserSectionSettings,
  type NewsletterSectionSettings,
  type PublicHomeSection,
  type UspBarSectionSettings,
  type VideoBannerSectionSettings,
} from '@lulwah/contracts';
import type { AppLocale } from '@/i18n/routing';

/**
 * `GET /content/home`'s `settings` field is deliberately a loose
 * `z.record()` on the wire (see `@lulwah/contracts`' `content.ts#HomeSection`
 * doc comment: Zod can't key a field's schema off a sibling field inside one
 * `z.object()`) — this module is where the storefront recovers the real,
 * per-type settings shape, the same discriminated-union validation
 * `apps/api/.../content/home-section.service.ts#parseSettingsForType` already
 * does API-side for writes. Nothing here invents fields the real contract
 * (`packages/contracts/src/content.ts`) doesn't have.
 */

interface TypedSectionSettingsMap {
  hero: HeroSectionSettings;
  collection_rail: CollectionRailSectionSettings;
  editorial_split: EditorialSplitSectionSettings;
  brand_strip: BrandStripSectionSettings;
  category_grid: CategoryGridSectionSettings;
  video_banner: VideoBannerSectionSettings;
  usp_bar: UspBarSectionSettings;
  journal_teaser: JournalTeaserSectionSettings;
  newsletter: NewsletterSectionSettings;
}

export type TypedHomeSection = {
  [K in HomeSectionType]: { id: string; type: K; sortOrder: number; settings: TypedSectionSettingsMap[K] };
}[HomeSectionType];

/**
 * Validates each section's loose `settings` record against the real typed
 * schema for its `type`. A section that fails (an in-flight admin edit
 * caught mid-save, or a settings shape from a since-changed schema version)
 * is skipped with a logged warning rather than throwing — one malformed CMS
 * row must never take down the whole homepage (the same "search must never
 * 500" spirit `docs/implemented-plan.md` §4.4 documents for `GET /search`).
 */
export function parseHomeSections(sections: readonly PublicHomeSection[]): TypedHomeSection[] {
  const parsed: TypedHomeSection[] = [];
  for (const section of sections) {
    const schema = HOME_SECTION_SETTINGS_SCHEMAS[section.type];
    const result = schema.safeParse(section.settings);
    if (!result.success) {
      console.error(
        `[content-mappers] Skipping home section ${section.id} (type "${section.type}"): settings failed validation against the real contract.`,
        result.error.issues,
      );
      continue;
    }
    parsed.push({
      id: section.id,
      type: section.type,
      sortOrder: section.sortOrder,
      settings: result.data,
    } as TypedHomeSection);
  }
  return parsed;
}

/** Type-narrowing filter helper — `sections.filter(isHomeSectionType('hero'))`
 *  gives back a properly-narrowed `Extract<TypedHomeSection, { type: 'hero' }>[]`,
 *  needed wherever a caller needs more than one section of the same type
 *  (e.g. resolving live product data for every `collection_rail` section). */
export function isHomeSectionType<T extends HomeSectionType>(type: T) {
  return (section: TypedHomeSection): section is Extract<TypedHomeSection, { type: T }> => section.type === type;
}

/** Picks the locale-appropriate string out of an EN/AR field pair — every
 *  content settings shape carries both, never a single locale-agnostic field. */
export function pickLocale(en: string, ar: string, locale: AppLocale): string {
  return locale === 'ar' ? ar : en;
}

/**
 * `CollectionRailSectionSettings` (plan.md §15.2 §2/§6, `content.ts`'s own
 * doc comment) carries a `collectionId` for a specific collection, or null
 * to mean "fall back to a live `sort=newest`/`sort=bestselling` product
 * query" — but the real settings shape has no field naming *which* sort a
 * null-`collectionId` rail wants (there's no such field in the contract,
 * and the two historical rails — "New arrivals"/"Best sellers" — are both
 * this exact same section type, distinguished only by which collection or
 * fallback sort an admin configures). `viewAllHref` is the only real,
 * admin-authored signal that tells them apart in practice (the Content
 * admin screen's homepage builder lets an editor set it freely per
 * section), so it's used as the discriminator here — a documented judgment
 * call, not a fabricated contract field.
 */
export function inferCollectionRailSort(viewAllHref: string | null): 'newest' | 'bestselling' {
  if (viewAllHref && /best[-_]?sell/i.test(viewAllHref)) return 'bestselling';
  return 'newest';
}

/**
 * `category_grid` (plan.md §15.2 §3/§8, `content.ts`'s own doc comment) is
 * one settings shape shared by two visually distinct existing components —
 * `ShopByStitching` ("three full-height panels") and `OccasionTiles` ("five
 * tiles in the 5-column editorial grid") — told apart only by tile count in
 * the plan's own framing ("just a different tile count"). This is the
 * storefront-side dispatch rule that decision implies: 1–3 tiles renders as
 * the full-height-panel treatment, 4+ as the grid-of-tiles treatment. Zero
 * tiles (an unconfigured section) renders nothing — there's no honest
 * fallback content to show for a section that genuinely has none.
 */
export function categoryGridVariant(tileCount: number): 'panels' | 'grid' | 'none' {
  if (tileCount === 0) return 'none';
  return tileCount <= 3 ? 'panels' : 'grid';
}

/** CMS-authored hrefs (`linkHref`, `viewAllHref`, a `CategoryGridTile.href`)
 *  are arbitrary admin-typed strings, unlike this codebase's other links
 *  (always a known internal path) — an external URL must never be routed
 *  through next-intl's locale-prefixing `Link`. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
