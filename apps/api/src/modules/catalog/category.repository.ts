import type { MediaRef } from '@lulwah/contracts';
import type { PartialWithUndefined } from '../../shared/types.js';
import { CategoryModel } from './category.model.js';
import type { CategoryDoc, CategoryHydratedDoc } from './category.model.js';
import { toMediaRefSubdoc } from './media.mapper.js';

/** The ONLY file allowed to touch `CategoryModel` (plan.md §5.4).
 *  `parentId`/`image` are typed against the input (string id / `MediaRef`)
 *  rather than `CategoryDoc`'s Mongoose-native shape — see
 *  `brand.repository.ts`'s equivalent comment. */
export type CreateCategoryInput = Pick<CategoryDoc, 'name' | 'slug' | 'path' | 'level'> &
  Partial<Pick<CategoryDoc, 'nameAr' | 'sortOrder' | 'isActive' | 'showInMenu'>> &
  Partial<{ parentId: string | null; image: MediaRef | null }>;

export type UpdateCategoryInput = PartialWithUndefined<CreateCategoryInput>;

const NOT_DELETED = { deletedAt: null };

export async function createCategory(input: CreateCategoryInput): Promise<CategoryHydratedDoc> {
  const { image, ...rest } = input;
  return CategoryModel.create({ ...rest, ...(image !== undefined ? { image: toMediaRefSubdoc(image) } : {}) });
}

export async function findCategoryBySlug(slug: string): Promise<CategoryHydratedDoc | null> {
  return CategoryModel.findOne({ slug, ...NOT_DELETED }).exec();
}

export async function findCategoryById(id: string): Promise<CategoryHydratedDoc | null> {
  return CategoryModel.findOne({ _id: id, ...NOT_DELETED }).exec();
}

export async function findCategoriesByIds(ids: readonly string[]): Promise<CategoryHydratedDoc[]> {
  return CategoryModel.find({ _id: { $in: ids }, ...NOT_DELETED }).exec();
}

/** Full tree (flat list, ordered) — the caller (`category.service.ts`)
 *  nests it in memory rather than doing N recursive queries. */
export async function listActiveTree(): Promise<CategoryHydratedDoc[]> {
  return CategoryModel.find({ isActive: true, ...NOT_DELETED }).sort({ level: 1, sortOrder: 1, name: 1 }).exec();
}

export async function listAllCategories(page: number, limit: number): Promise<{ categories: CategoryHydratedDoc[]; total: number }> {
  const filter = NOT_DELETED;
  const [categories, total] = await Promise.all([
    CategoryModel.find(filter)
      .sort({ level: 1, sortOrder: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    CategoryModel.countDocuments(filter).exec(),
  ]);
  return { categories, total };
}

export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<CategoryHydratedDoc | null> {
  const { image, ...rest } = input;
  return CategoryModel.findOneAndUpdate(
    { _id: id, ...NOT_DELETED },
    { ...rest, ...(image !== undefined ? { image: toMediaRefSubdoc(image) } : {}) },
    { returnDocument: 'after' },
  ).exec();
}

export async function softDeleteCategory(id: string): Promise<boolean> {
  const result = await CategoryModel.updateOne({ _id: id, ...NOT_DELETED }, { deletedAt: new Date(), isActive: false }).exec();
  return result.modifiedCount > 0;
}
