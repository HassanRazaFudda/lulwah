import { z } from 'zod';
import { Brand, MediaRef } from '@lulwah/contracts';

export const ListBrandsResponse = z.object({ brands: z.array(Brand) });
export type ListBrandsResponse = z.infer<typeof ListBrandsResponse>;

export const AdminListBrandsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type AdminListBrandsQuery = z.infer<typeof AdminListBrandsQuery>;

/**
 * `AdminUpdateBrandInput` is built from `BASE_FIELDS` (no `.default()` on
 * it) rather than `AdminCreateBrandInput.partial()` — a real bug found
 * while building the `pricing` module's own admin CRUD (see that module's
 * `pricing.dto.ts` doc comment for the full mechanism): Zod's `.partial()`
 * still fires a field's own `.default(...)` when the key is entirely
 * absent, so `PATCH /admin/brands/:id { name: 'New Name' }` was silently
 * resetting `isActive` to `true` and `isFeatured` to `false` on every
 * partial edit — e.g. deactivating a brand, then renaming it, would have
 * silently reactivated it.
 */
const BASE_FIELDS = {
  name: z.string().min(1),
  nameAr: z.string(),
  slug: z.string().min(1).optional(),
  description: z.string(),
  descriptionAr: z.string(),
  logo: MediaRef.nullable(),
  coverImage: MediaRef.nullable(),
  countryOfOrigin: z.string().length(2),
  sortOrder: z.number().int(),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
};

export const AdminCreateBrandInput = z.object({
  ...BASE_FIELDS,
  nameAr: BASE_FIELDS.nameAr.default(''),
  description: BASE_FIELDS.description.default(''),
  descriptionAr: BASE_FIELDS.descriptionAr.default(''),
  logo: BASE_FIELDS.logo.default(null),
  coverImage: BASE_FIELDS.coverImage.default(null),
  countryOfOrigin: BASE_FIELDS.countryOfOrigin.default('PK'),
  sortOrder: BASE_FIELDS.sortOrder.default(0),
  isFeatured: BASE_FIELDS.isFeatured.default(false),
  isActive: BASE_FIELDS.isActive.default(true),
});
export type AdminCreateBrandInput = z.infer<typeof AdminCreateBrandInput>;

export const AdminUpdateBrandInput = z.object(BASE_FIELDS).partial();
export type AdminUpdateBrandInput = z.infer<typeof AdminUpdateBrandInput>;

export const AdminBrandResponse = z.object({ brand: Brand });
export type AdminBrandResponse = z.infer<typeof AdminBrandResponse>;
