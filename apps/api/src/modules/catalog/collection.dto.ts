import { z } from 'zod';
import { Collection, CollectionLayout, CollectionStatus, CollectionType, MediaRef, objectId } from '@lulwah/contracts';

export const ListCollectionsQuery = z.object({
  status: CollectionStatus.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(24),
});
export type ListCollectionsQuery = z.infer<typeof ListCollectionsQuery>;

export const ListCollectionsResponse = z.object({ collections: z.array(Collection) });
export type ListCollectionsResponse = z.infer<typeof ListCollectionsResponse>;

export const AdminCreateCollectionInput = z.object({
  name: z.string().min(1),
  nameAr: z.string().default(''),
  slug: z.string().min(1).optional(),
  subtitle: z.string().default(''),
  descriptionEn: z.string().default(''),
  descriptionAr: z.string().default(''),
  brandId: objectId.nullable().default(null),
  type: CollectionType,
  productIds: z.array(objectId).default([]),
  heroImage: MediaRef.nullable().default(null),
  launchAt: z.coerce.date().nullable().default(null),
  endAt: z.coerce.date().nullable().default(null),
  status: CollectionStatus.default('draft'),
  layout: CollectionLayout.default('grid'),
  sortOrder: z.number().int().default(0),
  isFeatured: z.boolean().default(false),
});
export type AdminCreateCollectionInput = z.infer<typeof AdminCreateCollectionInput>;

export const AdminUpdateCollectionInput = AdminCreateCollectionInput.partial();
export type AdminUpdateCollectionInput = z.infer<typeof AdminUpdateCollectionInput>;

export const AdminCollectionResponse = z.object({ collection: Collection });
export type AdminCollectionResponse = z.infer<typeof AdminCollectionResponse>;
