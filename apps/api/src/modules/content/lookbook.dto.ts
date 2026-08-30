import { z } from 'zod';
import { Lookbook, LookbookStatus, MediaRef, PageSeo, objectId } from '@lulwah/contracts';

/** See `page.dto.ts`'s doc comment on why `BASE_FIELDS` (no `.default()`)
 *  feeds both a defaulted create schema and a bare `.partial()` update
 *  schema, rather than deriving update from create. */
const BASE_FIELDS = {
  slug: z.string().min(1).optional(),
  titleEn: z.string().min(1),
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
};

export const AdminCreateLookbookInput = z.object({
  ...BASE_FIELDS,
  titleAr: BASE_FIELDS.titleAr.default(''),
  heroMedia: BASE_FIELDS.heroMedia.default(null),
  heroMediaMobile: BASE_FIELDS.heroMediaMobile.default(null),
  gallery: BASE_FIELDS.gallery.default([]),
  bodyEn: BASE_FIELDS.bodyEn.default(''),
  bodyAr: BASE_FIELDS.bodyAr.default(''),
  collectionId: BASE_FIELDS.collectionId.default(null),
  status: BASE_FIELDS.status.default('draft'),
  seo: BASE_FIELDS.seo.default({}),
  sortOrder: BASE_FIELDS.sortOrder.default(0),
});
export type AdminCreateLookbookInput = z.infer<typeof AdminCreateLookbookInput>;

export const AdminUpdateLookbookInput = z.object(BASE_FIELDS).partial();
export type AdminUpdateLookbookInput = z.infer<typeof AdminUpdateLookbookInput>;

export const AdminListLookbooksQuery = z.object({
  status: LookbookStatus.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type AdminListLookbooksQuery = z.infer<typeof AdminListLookbooksQuery>;

export const AdminLookbookListResponse = z.object({ lookbooks: z.array(Lookbook) });
export type AdminLookbookListResponse = z.infer<typeof AdminLookbookListResponse>;

export const AdminLookbookResponse = z.object({ lookbook: Lookbook });
export type AdminLookbookResponse = z.infer<typeof AdminLookbookResponse>;
