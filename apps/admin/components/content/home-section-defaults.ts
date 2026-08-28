import type { HomeSectionType } from '@lulwah/contracts';

/**
 * Starting `settings` payload per §11.1 home-section type, mirroring each
 * of the 9 `HOME_SECTION_SETTINGS_SCHEMAS` entries in `@lulwah/contracts`'
 * `content.ts` field-for-field. Only the array-typed fields there declare a
 * Zod `.default()` — every plain `z.string()` field is still required (no
 * `.min()`, so `''` validates), so an empty string is a legitimate,
 * server-accepted starting value for those, not a placeholder this file is
 * inventing.
 */
export function defaultHomeSectionSettings(type: HomeSectionType): Record<string, unknown> {
  switch (type) {
    case 'hero':
      return {
        headlineEn: '',
        headlineAr: '',
        media: null,
        mediaMobile: null,
        videoUrl: null,
        linkLabelEn: '',
        linkLabelAr: '',
        linkHref: '',
        collectionId: null,
      };
    case 'collection_rail':
      return { titleEn: '', titleAr: '', collectionId: null, limit: 6, viewAllHref: null };
    case 'editorial_split':
      return { titleEn: '', titleAr: '', bodyEn: '', bodyAr: '', media: null, linkHref: null, mediaPosition: 'left' };
    case 'brand_strip':
      return { brandIds: [] };
    case 'category_grid':
      return { titleEn: '', titleAr: '', tiles: [] };
    case 'video_banner':
      return { media: null, videoUrl: null, captionEn: '', captionAr: '' };
    case 'usp_bar':
      return { itemsEn: [], itemsAr: [] };
    case 'journal_teaser':
      return { postSlugs: [] };
    case 'newsletter':
      return { headlineEn: '', headlineAr: '', subtextEn: '', subtextAr: '' };
    default:
      return {};
  }
}

export const HOME_SECTION_TYPE_LABELS: Record<HomeSectionType, string> = {
  hero: 'Hero',
  collection_rail: 'Collection rail',
  editorial_split: 'Editorial split',
  brand_strip: 'Brand strip',
  category_grid: 'Category grid',
  video_banner: 'Video / full-bleed banner',
  usp_bar: 'USP bar',
  journal_teaser: 'Journal teaser',
  newsletter: 'Newsletter signup',
};
