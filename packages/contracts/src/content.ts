import { z } from 'zod';
import { objectId } from './common.js';
import { MediaRef } from './product.js';

/**
 * Content/CMS — plan.md §7.13 (`home_sections`, `banners`, `menus`, `pages`,
 * `media`) and §15.2 (the Home page's fixed section order). Built as a new
 * `content` module (plan.md §11.1's Content admin screen) — NOT a
 * duplicate of the `collection` concern, which already lives in `catalog`
 * (see `collection.ts`) and is only extended here where P3 needs new
 * fields on it.
 */

// ---------------------------------------------------------------------------
// Home sections — plan.md §7.13's `home_sections.type` enum, plus
// `newsletter` (§15.2 fixes a dedicated emerald newsletter-signup panel as
// the last section of the launch composition, with no other listed type it
// naturally maps onto — a small, documented extension of the abbreviated
// table, not an invented-from-scratch shape).
// ---------------------------------------------------------------------------

export const HomeSectionType = z.enum([
  'hero',
  'collection_rail',
  'editorial_split',
  'brand_strip',
  'category_grid',
  'video_banner',
  'usp_bar',
  'journal_teaser',
  'newsletter',
]);
export type HomeSectionType = z.infer<typeof HomeSectionType>;

/** plan.md §15.2 §1 — full-viewport campaign hero, one text link, optional
 *  video. `collectionId` is what "See the collection" links to. */
export const HeroSectionSettings = z.object({
  headlineEn: z.string(),
  headlineAr: z.string(),
  media: MediaRef.nullable(),
  mediaMobile: MediaRef.nullable(),
  videoUrl: z.string().nullable(),
  linkLabelEn: z.string(),
  linkLabelAr: z.string(),
  linkHref: z.string(),
  collectionId: objectId.nullable(),
});
export type HeroSectionSettings = z.infer<typeof HeroSectionSettings>;

/** plan.md §15.2 §2/§6 — "New arrivals rail" and "Best sellers" are both
 *  this section type pointed at a different collection (or left null to
 *  fall back to a `sort=newest`/`sort=bestselling` product query — a
 *  storefront-side decision, this settings shape just carries the intent). */
export const CollectionRailSectionSettings = z.object({
  titleEn: z.string(),
  titleAr: z.string(),
  collectionId: objectId.nullable(),
  limit: z.number().int().positive().max(24).default(6),
  viewAllHref: z.string().nullable(),
});
export type CollectionRailSectionSettings = z.infer<typeof CollectionRailSectionSettings>;

/** plan.md §15.2 §4 — "3/2 asymmetric: campaign image + a short paragraph". */
export const EditorialSplitSectionSettings = z.object({
  titleEn: z.string(),
  titleAr: z.string(),
  bodyEn: z.string(),
  bodyAr: z.string(),
  media: MediaRef.nullable(),
  linkHref: z.string().nullable(),
  mediaPosition: z.enum(['left', 'right']).default('left'),
});
export type EditorialSplitSectionSettings = z.infer<typeof EditorialSplitSectionSettings>;

/** plan.md §15.2 §5 — a marquee of brand wordmarks, each linking to its
 *  brand house page. */
export const BrandStripSectionSettings = z.object({
  brandIds: z.array(objectId).default([]),
});
export type BrandStripSectionSettings = z.infer<typeof BrandStripSectionSettings>;

/** plan.md §15.2 §3/§8 — "Shop by stitching" (3 panels) and "Shop by
 *  occasion" (5 tiles) are both a tile grid, just a different tile count. */
export const CategoryGridTile = z.object({
  labelEn: z.string(),
  labelAr: z.string(),
  image: MediaRef.nullable(),
  href: z.string(),
});
export type CategoryGridTile = z.infer<typeof CategoryGridTile>;

export const CategoryGridSectionSettings = z.object({
  titleEn: z.string(),
  titleAr: z.string(),
  tiles: z.array(CategoryGridTile).max(8).default([]),
});
export type CategoryGridSectionSettings = z.infer<typeof CategoryGridSectionSettings>;

/** plan.md §15.2 §7 — "a single fabric macro image, no text, pure rhythm." */
export const VideoBannerSectionSettings = z.object({
  media: MediaRef.nullable(),
  videoUrl: z.string().nullable(),
  captionEn: z.string().default(''),
  captionAr: z.string().default(''),
});
export type VideoBannerSectionSettings = z.infer<typeof VideoBannerSectionSettings>;

/** plan.md §15.2 §9 — "text-only USP bar ... Label type, hairline
 *  separators, no icons." `itemsEn`/`itemsAr` are parallel arrays, one
 *  string per USP. */
export const UspBarSectionSettings = z.object({
  itemsEn: z.array(z.string()).default([]),
  itemsAr: z.array(z.string()).default([]),
});
export type UspBarSectionSettings = z.infer<typeof UspBarSectionSettings>;

/** plan.md §15.2 §10 (R2) — "two posts." References journal post slugs.
 *  `JournalPost` now exists (see below) — `postSlugs` holds real
 *  `JournalPost.slug` values; `GET /content/journal?slugs=...` is the
 *  resolution mechanism (see that section's own doc comment). Rendering
 *  this section on the storefront is still a separate, later pass — this
 *  settings shape needed no change, it already matches a real slug 1:1. */
export const JournalTeaserSectionSettings = z.object({
  postSlugs: z.array(z.string()).max(4).default([]),
});
export type JournalTeaserSectionSettings = z.infer<typeof JournalTeaserSectionSettings>;

/** plan.md §15.2 §11 — "emerald panel, one field, consent checkbox." */
export const NewsletterSectionSettings = z.object({
  headlineEn: z.string(),
  headlineAr: z.string(),
  subtextEn: z.string().default(''),
  subtextAr: z.string().default(''),
});
export type NewsletterSectionSettings = z.infer<typeof NewsletterSectionSettings>;

/** One typed settings schema per §11.1's "typed settings form" — the write
 *  boundary (`AdminCreateHomeSectionInput`, a discriminated union on `type`)
 *  validates against the matching schema here; the wire `HomeSection.settings`
 *  itself stays a loose record (see that field's own comment for why). */
export const HOME_SECTION_SETTINGS_SCHEMAS = {
  hero: HeroSectionSettings,
  collection_rail: CollectionRailSectionSettings,
  editorial_split: EditorialSplitSectionSettings,
  brand_strip: BrandStripSectionSettings,
  category_grid: CategoryGridSectionSettings,
  video_banner: VideoBannerSectionSettings,
  usp_bar: UspBarSectionSettings,
  journal_teaser: JournalTeaserSectionSettings,
  newsletter: NewsletterSectionSettings,
} as const satisfies Record<HomeSectionType, z.ZodType>;

export const HomeSection = z.object({
  id: objectId,
  type: HomeSectionType,
  // A loose record, not `HOME_SECTION_SETTINGS_SCHEMAS[type]` — Zod can't
  // key a field's schema off a sibling field's runtime value inside one
  // `z.object()`. The write-boundary DTO (`AdminCreateHomeSectionInput`)
  // enforces the real per-type shape via a discriminated union instead;
  // this read-side shape only needs to round-trip whatever was validated in.
  settings: z.record(z.string(), z.unknown()),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  startsAt: z.coerce.date().nullable(),
  endsAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type HomeSection = z.infer<typeof HomeSection>;

/** `GET /content/home` — no admin scheduling fields (`isActive`/`startsAt`/
 *  `endsAt`), the endpoint already only returns sections currently in their
 *  active window. */
export const PublicHomeSection = z.object({
  id: objectId,
  type: HomeSectionType,
  settings: z.record(z.string(), z.unknown()),
  sortOrder: z.number().int(),
});
export type PublicHomeSection = z.infer<typeof PublicHomeSection>;

// ---------------------------------------------------------------------------
// Banners — plan.md §7.13: "placement, mediaDesktop, mediaMobile, link,
// textEn/Ar, startsAt, endsAt".
// ---------------------------------------------------------------------------

export const BannerPlacement = z.enum(['announcement', 'homepage_top', 'plp_top', 'cart']);
export type BannerPlacement = z.infer<typeof BannerPlacement>;

export const Banner = z.object({
  id: objectId,
  placement: BannerPlacement,
  mediaDesktop: MediaRef.nullable(),
  mediaMobile: MediaRef.nullable(),
  link: z.string().nullable(),
  textEn: z.string(),
  textAr: z.string(),
  isActive: z.boolean(),
  startsAt: z.coerce.date().nullable(),
  endsAt: z.coerce.date().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Banner = z.infer<typeof Banner>;

export const PublicBanner = z.object({
  id: objectId,
  placement: BannerPlacement,
  mediaDesktop: MediaRef.nullable(),
  mediaMobile: MediaRef.nullable(),
  link: z.string().nullable(),
  textEn: z.string(),
  textAr: z.string(),
});
export type PublicBanner = z.infer<typeof PublicBanner>;

// ---------------------------------------------------------------------------
// Menus — plan.md §7.13: "location, items:[{label, labelAr, href, children[],
// featuredMedia, badge}]".
// ---------------------------------------------------------------------------

export const MenuLocation = z.enum(['header', 'footer', 'mobile']);
export type MenuLocation = z.infer<typeof MenuLocation>;

export interface MenuItemNode {
  id: string;
  label: string;
  labelAr: string;
  href: string;
  featuredMedia: MediaRef | null;
  badge: string | null;
  sortOrder: number;
  children: MenuItemNode[];
}

/** Recursive — a nav item can hold its own nested children (plan.md §11.1
 *  "nested drag-and-drop with featured imagery per column"), so this can't
 *  be a plain `z.object()`; `z.lazy()` is Zod's documented way to type a
 *  self-referential schema. */
export const MenuItem: z.ZodType<MenuItemNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    labelAr: z.string(),
    href: z.string(),
    featuredMedia: MediaRef.nullable(),
    badge: z.string().nullable(),
    sortOrder: z.number().int(),
    children: z.array(MenuItem),
  }),
);

/** `location` doubles as the menu's own lookup key — plan.md's `menus`
 *  table has no separate `key` field, and only one active menu per
 *  location makes sense for a header/footer/mobile nav. `GET
 *  /content/menus/:key` (the public route the storefront will call later)
 *  takes a `MenuLocation` value as `:key`. */
export const Menu = z.object({
  id: objectId,
  location: MenuLocation,
  items: z.array(MenuItem),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Menu = z.infer<typeof Menu>;

export const PublicMenu = z.object({
  location: MenuLocation,
  items: z.array(MenuItem),
});
export type PublicMenu = z.infer<typeof PublicMenu>;

// ---------------------------------------------------------------------------
// Pages — plan.md §7.13: "slug, titleEn/Ar, bodyEn/Ar(rich), status, seo".
// `bodyEn`/`bodyAr` are sanitized HTML (plan.md §19: "HTML sanitised with
// isomorphic-dompurify on any rich-text field") — see content module's
// `sanitize.ts`, the first rich-text field in this codebase.
// ---------------------------------------------------------------------------

export const PageStatus = z.enum(['draft', 'published']);
export type PageStatus = z.infer<typeof PageStatus>;

export const PageSeo = z.object({
  titleEn: z.string().optional(),
  titleAr: z.string().optional(),
  descEn: z.string().optional(),
  descAr: z.string().optional(),
});
export type PageSeo = z.infer<typeof PageSeo>;

export const Page = z.object({
  id: objectId,
  slug: z.string(),
  titleEn: z.string(),
  titleAr: z.string(),
  bodyEn: z.string(),
  bodyAr: z.string(),
  status: PageStatus,
  seo: PageSeo,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Page = z.infer<typeof Page>;

/** `GET /content/pages/:slug` — only ever a published page (the service
 *  layer 404s a draft), so `status` is redundant on the wire; kept off. */
export const PublicPage = z.object({
  slug: z.string(),
  titleEn: z.string(),
  titleAr: z.string(),
  bodyEn: z.string(),
  bodyAr: z.string(),
  seo: PageSeo,
});
export type PublicPage = z.infer<typeof PublicPage>;

// ---------------------------------------------------------------------------
// Lookbooks — plan.md §11.1's content-domain table lists `Lookbook` as its
// own `content` entity, alongside `Page`/`Banner`/`HomeSection`/`Menu`/`Media`
// — NOT a duplicate of `Collection.layout`'s `'lookbook'` value or its
// `lookbookMedia` field above (`collection.ts`): those describe how a
// shoppable Collection *renders*; this is the standalone editorial-gallery
// entity itself, with its own slug/route. `collectionId` is the optional
// "shop this look" tie-in back to a real Collection — a bare `objectId`
// reference, not a populated relation, same "no cross-module validation"
// posture `HeroSectionSettings.collectionId` above already establishes.
// `bodyEn`/`bodyAr`/`seo` mirror `Page`'s own shape verbatim (sanitized
// HTML — see `content` module's `sanitize.ts`).
// ---------------------------------------------------------------------------

export const LookbookStatus = z.enum(['draft', 'published']);
export type LookbookStatus = z.infer<typeof LookbookStatus>;

export const Lookbook = z.object({
  id: objectId,
  slug: z.string(),
  titleEn: z.string(),
  titleAr: z.string(),
  heroMedia: MediaRef.nullable(),
  heroMediaMobile: MediaRef.nullable(),
  gallery: z.array(MediaRef),
  bodyEn: z.string(),
  bodyAr: z.string(),
  collectionId: objectId.nullable(),
  status: LookbookStatus,
  seo: PageSeo,
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Lookbook = z.infer<typeof Lookbook>;

/** `GET /content/lookbooks[/:slug]` — published lookbooks only (the service
 *  layer 404s a draft slug); no admin-only `status` on the wire, same trim
 *  `PublicPage` applies. */
export const PublicLookbook = z.object({
  slug: z.string(),
  titleEn: z.string(),
  titleAr: z.string(),
  heroMedia: MediaRef.nullable(),
  heroMediaMobile: MediaRef.nullable(),
  gallery: z.array(MediaRef),
  bodyEn: z.string(),
  bodyAr: z.string(),
  collectionId: objectId.nullable(),
  seo: PageSeo,
});
export type PublicLookbook = z.infer<typeof PublicLookbook>;

// ---------------------------------------------------------------------------
// Journal — blog-style editorial posts (plan.md §11.1's content-domain
// table; also plan.md's `/[locale]/journal /journal/[slug]` route). Backs
// `journal_teaser` above — `JournalTeaserSectionSettings.postSlugs` now
// resolve to real `JournalPost.slug` values via `GET
// /content/journal?slugs=a,b,c` (see `journal.dto.ts#ListJournalPostsQuery`
// in the `content` API module), which returns published posts in the
// requested slug order, dropping any slug that's unknown or still a draft —
// the storefront rendering of the section itself is a separate, later pass.
// `excerptEn`/`excerptAr` are the short teaser text that section needs
// without pulling a post's full body. `bodyEn`/`bodyAr`/`seo` again mirror
// `Page`'s shape.
// ---------------------------------------------------------------------------

export const JournalPostStatus = z.enum(['draft', 'published']);
export type JournalPostStatus = z.infer<typeof JournalPostStatus>;

export const JournalPost = z.object({
  id: objectId,
  slug: z.string(),
  titleEn: z.string(),
  titleAr: z.string(),
  coverMedia: MediaRef.nullable(),
  excerptEn: z.string(),
  excerptAr: z.string(),
  bodyEn: z.string(),
  bodyAr: z.string(),
  publishedAt: z.coerce.date().nullable(),
  status: JournalPostStatus,
  seo: PageSeo,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type JournalPost = z.infer<typeof JournalPost>;

/** `GET /content/journal[/:slug]` — published posts only. */
export const PublicJournalPost = z.object({
  slug: z.string(),
  titleEn: z.string(),
  titleAr: z.string(),
  coverMedia: MediaRef.nullable(),
  excerptEn: z.string(),
  excerptAr: z.string(),
  bodyEn: z.string(),
  bodyAr: z.string(),
  publishedAt: z.coerce.date().nullable(),
  seo: PageSeo,
});
export type PublicJournalPost = z.infer<typeof PublicJournalPost>;

// ---------------------------------------------------------------------------
// Media library — plan.md §7.13: "publicId, url, type, width, height, bytes,
// alt, altAr, folder, tags[], dominantColor, uploadedBy". See content
// module's doc comment for why this is a metadata layer over the existing
// paste-a-URL approach (`catalog/media.service.ts`), not a new upload/S3
// pipeline — none exists anywhere in this codebase to extend.
// ---------------------------------------------------------------------------

export const MediaAssetType = z.enum(['image', 'video']);
export type MediaAssetType = z.infer<typeof MediaAssetType>;

export const MediaAsset = z.object({
  id: objectId,
  publicId: z.string(),
  url: z.string(),
  type: MediaAssetType,
  width: z.number().int().nonnegative().nullable(),
  height: z.number().int().nonnegative().nullable(),
  bytes: z.number().int().nonnegative().nullable(),
  alt: z.string(),
  altAr: z.string(),
  folder: z.string(), // '' = root
  tags: z.array(z.string()),
  dominantColor: z.string().nullable(),
  uploadedBy: objectId.nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type MediaAsset = z.infer<typeof MediaAsset>;
