import { z } from 'zod';
import { Collection, CollectionLayout, CollectionRule, CollectionStatus, CollectionType, MediaRef, objectId } from '@lulwah/contracts';

export const ListCollectionsQuery = z.object({
  status: CollectionStatus.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(24),
});
export type ListCollectionsQuery = z.infer<typeof ListCollectionsQuery>;

export const ListCollectionsResponse = z.object({ collections: z.array(Collection) });
export type ListCollectionsResponse = z.infer<typeof ListCollectionsResponse>;

/** See `brand.dto.ts`'s doc comment: built from `BASE_FIELDS` (no
 *  `.default()`) rather than `AdminCreateCollectionInput.partial()`, which
 *  was silently resetting `status` to `'draft'` and `layout` to `'grid'`
 *  (among other fields) on every partial `PATCH` — e.g. editing a live
 *  collection's `sortOrder` alone would have silently un-published it. */
const BASE_FIELDS = {
  name: z.string().min(1),
  nameAr: z.string(),
  slug: z.string().min(1).optional(),
  subtitle: z.string(),
  descriptionEn: z.string(),
  descriptionAr: z.string(),
  brandId: objectId.nullable(),
  type: CollectionType,
  rules: z.array(CollectionRule),
  productIds: z.array(objectId),
  heroImage: MediaRef.nullable(),
  heroImageMobile: MediaRef.nullable(),
  launchAt: z.coerce.date().nullable(),
  endAt: z.coerce.date().nullable(),
  isTeaserVisible: z.boolean(),
  status: CollectionStatus,
  layout: CollectionLayout,
  sortOrder: z.number().int(),
  isFeatured: z.boolean(),
};

export const AdminCreateCollectionInput = z.object({
  ...BASE_FIELDS,
  nameAr: BASE_FIELDS.nameAr.default(''),
  subtitle: BASE_FIELDS.subtitle.default(''),
  descriptionEn: BASE_FIELDS.descriptionEn.default(''),
  descriptionAr: BASE_FIELDS.descriptionAr.default(''),
  brandId: BASE_FIELDS.brandId.default(null),
  rules: BASE_FIELDS.rules.default([]),
  productIds: BASE_FIELDS.productIds.default([]),
  heroImage: BASE_FIELDS.heroImage.default(null),
  heroImageMobile: BASE_FIELDS.heroImageMobile.default(null),
  launchAt: BASE_FIELDS.launchAt.default(null),
  endAt: BASE_FIELDS.endAt.default(null),
  isTeaserVisible: BASE_FIELDS.isTeaserVisible.default(false),
  status: BASE_FIELDS.status.default('draft'),
  layout: BASE_FIELDS.layout.default('grid'),
  sortOrder: BASE_FIELDS.sortOrder.default(0),
  isFeatured: BASE_FIELDS.isFeatured.default(false),
});
export type AdminCreateCollectionInput = z.infer<typeof AdminCreateCollectionInput>;

export const AdminUpdateCollectionInput = z.object(BASE_FIELDS).partial();
export type AdminUpdateCollectionInput = z.infer<typeof AdminUpdateCollectionInput>;

export const AdminCollectionResponse = z.object({ collection: Collection });
export type AdminCollectionResponse = z.infer<typeof AdminCollectionResponse>;
