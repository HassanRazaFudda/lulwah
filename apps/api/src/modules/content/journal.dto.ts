import { z } from 'zod';
import { JournalPost, JournalPostStatus, MediaRef, PageSeo, PublicJournalPost } from '@lulwah/contracts';

/** See `page.dto.ts`'s doc comment on why `BASE_FIELDS` (no `.default()`)
 *  feeds both a defaulted create schema and a bare `.partial()` update
 *  schema, rather than deriving update from create. */
const BASE_FIELDS = {
  slug: z.string().min(1).optional(),
  titleEn: z.string().min(1),
  titleAr: z.string(),
  coverMedia: MediaRef.nullable(),
  excerptEn: z.string(),
  excerptAr: z.string(),
  bodyEn: z.string(),
  bodyAr: z.string(),
  publishedAt: z.coerce.date().nullable(),
  status: JournalPostStatus,
  seo: PageSeo,
};

export const AdminCreateJournalPostInput = z.object({
  ...BASE_FIELDS,
  titleAr: BASE_FIELDS.titleAr.default(''),
  coverMedia: BASE_FIELDS.coverMedia.default(null),
  excerptEn: BASE_FIELDS.excerptEn.default(''),
  excerptAr: BASE_FIELDS.excerptAr.default(''),
  bodyEn: BASE_FIELDS.bodyEn.default(''),
  bodyAr: BASE_FIELDS.bodyAr.default(''),
  // `null` here means "not explicitly set" — `journal.service.ts#createJournalPost`
  // fills in "now" only if `status` is also `published` and this was left
  // at its default; an explicit value (even for a draft) always wins.
  publishedAt: BASE_FIELDS.publishedAt.default(null),
  status: BASE_FIELDS.status.default('draft'),
  seo: BASE_FIELDS.seo.default({}),
});
export type AdminCreateJournalPostInput = z.infer<typeof AdminCreateJournalPostInput>;

export const AdminUpdateJournalPostInput = z.object(BASE_FIELDS).partial();
export type AdminUpdateJournalPostInput = z.infer<typeof AdminUpdateJournalPostInput>;

export const AdminListJournalPostsQuery = z.object({
  status: JournalPostStatus.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type AdminListJournalPostsQuery = z.infer<typeof AdminListJournalPostsQuery>;

export const AdminJournalPostListResponse = z.object({ posts: z.array(JournalPost) });
export type AdminJournalPostListResponse = z.infer<typeof AdminJournalPostListResponse>;

export const AdminJournalPostResponse = z.object({ post: JournalPost });
export type AdminJournalPostResponse = z.infer<typeof AdminJournalPostResponse>;

/** `GET /content/journal` — published posts, newest-first by `publishedAt`,
 *  paginated. `slugs` (comma-separated, parsed in `journal.controller.ts`)
 *  narrows the list to exactly those slugs, in the order given, silently
 *  dropping any that are unknown or still a draft — the real
 *  `journal_teaser.postSlugs` → post resolution mechanism (see
 *  `@lulwah/contracts`' `JournalTeaserSectionSettings` doc comment); a
 *  future storefront-wiring pass calls this instead of the single-slug
 *  endpoint N times. */
export const ListJournalPostsQuery = z.object({
  slugs: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ListJournalPostsQuery = z.infer<typeof ListJournalPostsQuery>;

export const PublicJournalPostListResponse = z.object({ posts: z.array(PublicJournalPost) });
export type PublicJournalPostListResponse = z.infer<typeof PublicJournalPostListResponse>;

export const PublicJournalPostResponse = z.object({ post: PublicJournalPost });
export type PublicJournalPostResponse = z.infer<typeof PublicJournalPostResponse>;
