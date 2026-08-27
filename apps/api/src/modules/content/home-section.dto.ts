import { z } from 'zod';
import {
  BrandStripSectionSettings,
  CategoryGridSectionSettings,
  CollectionRailSectionSettings,
  EditorialSplitSectionSettings,
  HeroSectionSettings,
  HomeSection,
  JournalTeaserSectionSettings,
  NewsletterSectionSettings,
  PublicHomeSection,
  UspBarSectionSettings,
  VideoBannerSectionSettings,
} from '@lulwah/contracts';

const CommonScheduleFields = {
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().nullable().default(null),
  endsAt: z.coerce.date().nullable().default(null),
};

/** `{ type, settings }` validated together, per type — plan.md §11.1's
 *  "typed settings form". Create requires both up front; see
 *  `home-section.service.ts` for how an update (which may only touch the
 *  schedule, not the type/settings pair) reuses the same per-type schema
 *  map without forcing a full discriminated union on every PATCH. */
export const AdminCreateHomeSectionInput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hero'), settings: HeroSectionSettings, ...CommonScheduleFields }),
  z.object({ type: z.literal('collection_rail'), settings: CollectionRailSectionSettings, ...CommonScheduleFields }),
  z.object({ type: z.literal('editorial_split'), settings: EditorialSplitSectionSettings, ...CommonScheduleFields }),
  z.object({ type: z.literal('brand_strip'), settings: BrandStripSectionSettings, ...CommonScheduleFields }),
  z.object({ type: z.literal('category_grid'), settings: CategoryGridSectionSettings, ...CommonScheduleFields }),
  z.object({ type: z.literal('video_banner'), settings: VideoBannerSectionSettings, ...CommonScheduleFields }),
  z.object({ type: z.literal('usp_bar'), settings: UspBarSectionSettings, ...CommonScheduleFields }),
  z.object({ type: z.literal('journal_teaser'), settings: JournalTeaserSectionSettings, ...CommonScheduleFields }),
  z.object({ type: z.literal('newsletter'), settings: NewsletterSectionSettings, ...CommonScheduleFields }),
]);
export type AdminCreateHomeSectionInput = z.infer<typeof AdminCreateHomeSectionInput>;

/** Schedule/visibility fields only ever change independently of `type` +
 *  `settings` — kept as one flat, fully-optional schema so a PATCH that
 *  only reorders/toggles a section doesn't have to resend a whole settings
 *  payload. When `settings` IS present, `home-section.service.ts` validates
 *  it against `HOME_SECTION_SETTINGS_SCHEMAS[type ?? existing.type]`. */
export const AdminUpdateHomeSectionInput = z.object({
  type: z.enum([
    'hero', 'collection_rail', 'editorial_split', 'brand_strip', 'category_grid',
    'video_banner', 'usp_bar', 'journal_teaser', 'newsletter',
  ]).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});
export type AdminUpdateHomeSectionInput = z.infer<typeof AdminUpdateHomeSectionInput>;

export const ReorderHomeSectionsInput = z.object({
  orderedIds: z.array(z.string()).min(1),
});
export type ReorderHomeSectionsInput = z.infer<typeof ReorderHomeSectionsInput>;

export const AdminHomeSectionListResponse = z.object({ sections: z.array(HomeSection) });
export type AdminHomeSectionListResponse = z.infer<typeof AdminHomeSectionListResponse>;

export const AdminHomeSectionResponse = z.object({ section: HomeSection });
export type AdminHomeSectionResponse = z.infer<typeof AdminHomeSectionResponse>;

export const PublicHomeResponse = z.object({ sections: z.array(PublicHomeSection) });
export type PublicHomeResponse = z.infer<typeof PublicHomeResponse>;
