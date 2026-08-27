import { z } from 'zod';
import { Banner, BannerPlacement, MediaRef } from '@lulwah/contracts';

/** See `collection.dto.ts`'s doc comment on why `BASE_FIELDS` (no
 *  `.default()`) feeds both a defaulted create schema and a bare `.partial()`
 *  update schema, rather than deriving update from create — a partial of a
 *  defaulted schema would silently reset unset fields on every PATCH. */
const BASE_FIELDS = {
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
};

export const AdminCreateBannerInput = z.object({
  ...BASE_FIELDS,
  mediaDesktop: BASE_FIELDS.mediaDesktop.default(null),
  mediaMobile: BASE_FIELDS.mediaMobile.default(null),
  link: BASE_FIELDS.link.default(null),
  textEn: BASE_FIELDS.textEn.default(''),
  textAr: BASE_FIELDS.textAr.default(''),
  isActive: BASE_FIELDS.isActive.default(true),
  startsAt: BASE_FIELDS.startsAt.default(null),
  endsAt: BASE_FIELDS.endsAt.default(null),
  sortOrder: BASE_FIELDS.sortOrder.default(0),
});
export type AdminCreateBannerInput = z.infer<typeof AdminCreateBannerInput>;

export const AdminUpdateBannerInput = z.object(BASE_FIELDS).partial();
export type AdminUpdateBannerInput = z.infer<typeof AdminUpdateBannerInput>;

export const ListBannersQuery = z.object({
  placement: BannerPlacement.optional(),
});
export type ListBannersQuery = z.infer<typeof ListBannersQuery>;

export const AdminBannerListResponse = z.object({ banners: z.array(Banner) });
export type AdminBannerListResponse = z.infer<typeof AdminBannerListResponse>;

export const AdminBannerResponse = z.object({ banner: Banner });
export type AdminBannerResponse = z.infer<typeof AdminBannerResponse>;
