import { z } from 'zod';
import { Brand, MediaRef } from '@lulwah/contracts';

export const ListBrandsResponse = z.object({ brands: z.array(Brand) });
export type ListBrandsResponse = z.infer<typeof ListBrandsResponse>;

export const AdminListBrandsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type AdminListBrandsQuery = z.infer<typeof AdminListBrandsQuery>;

export const AdminCreateBrandInput = z.object({
  name: z.string().min(1),
  nameAr: z.string().default(''),
  slug: z.string().min(1).optional(),
  description: z.string().default(''),
  descriptionAr: z.string().default(''),
  logo: MediaRef.nullable().default(null),
  coverImage: MediaRef.nullable().default(null),
  countryOfOrigin: z.string().length(2).default('PK'),
  sortOrder: z.number().int().default(0),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type AdminCreateBrandInput = z.infer<typeof AdminCreateBrandInput>;

export const AdminUpdateBrandInput = AdminCreateBrandInput.partial();
export type AdminUpdateBrandInput = z.infer<typeof AdminUpdateBrandInput>;

export const AdminBrandResponse = z.object({ brand: Brand });
export type AdminBrandResponse = z.infer<typeof AdminBrandResponse>;
