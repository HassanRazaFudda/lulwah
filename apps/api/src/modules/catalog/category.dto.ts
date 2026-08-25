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

/** See `brand.dto.ts`'s doc comment: built from `BASE_FIELDS` (no
 *  `.default()`) rather than `AdminCreateCategoryInput.partial()`, which
 *  was silently resetting `isActive`/`showInMenu` to `true` and
 *  `parentId`/`image` to `null` on every partial `PATCH`. */
const BASE_FIELDS = {
  name: z.string().min(1),
  nameAr: z.string(),
  slug: z.string().min(1).optional(),
  parentId: objectId.nullable(),
  image: MediaRef.nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  showInMenu: z.boolean(),
};

export const AdminCreateCategoryInput = z.object({
  ...BASE_FIELDS,
  nameAr: BASE_FIELDS.nameAr.default(''),
  parentId: BASE_FIELDS.parentId.default(null),
  image: BASE_FIELDS.image.default(null),
  sortOrder: BASE_FIELDS.sortOrder.default(0),
  isActive: BASE_FIELDS.isActive.default(true),
  showInMenu: BASE_FIELDS.showInMenu.default(true),
});
export type AdminCreateCategoryInput = z.infer<typeof AdminCreateCategoryInput>;

export const AdminUpdateCategoryInput = z.object(BASE_FIELDS).partial();
export type AdminUpdateCategoryInput = z.infer<typeof AdminUpdateCategoryInput>;

export const AdminCategoryResponse = z.object({ category: Category });
export type AdminCategoryResponse = z.infer<typeof AdminCategoryResponse>;
