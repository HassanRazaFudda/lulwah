import { z } from 'zod';
import { Category, CategoryTreeNode, MediaRef, objectId } from '@lulwah/contracts';

export const CategoryTreeResponse = z.object({ categories: z.array(CategoryTreeNode) });
export type CategoryTreeResponse = z.infer<typeof CategoryTreeResponse>;

export const AdminListCategoriesQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(100),
});
export type AdminListCategoriesQuery = z.infer<typeof AdminListCategoriesQuery>;

export const ListCategoriesResponse = z.object({ categories: z.array(Category) });
export type ListCategoriesResponse = z.infer<typeof ListCategoriesResponse>;

export const AdminCreateCategoryInput = z.object({
  name: z.string().min(1),
  nameAr: z.string().default(''),
  slug: z.string().min(1).optional(),
  parentId: objectId.nullable().default(null),
  image: MediaRef.nullable().default(null),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  showInMenu: z.boolean().default(true),
});
export type AdminCreateCategoryInput = z.infer<typeof AdminCreateCategoryInput>;

export const AdminUpdateCategoryInput = AdminCreateCategoryInput.partial();
export type AdminUpdateCategoryInput = z.infer<typeof AdminUpdateCategoryInput>;

export const AdminCategoryResponse = z.object({ category: Category });
export type AdminCategoryResponse = z.infer<typeof AdminCategoryResponse>;
