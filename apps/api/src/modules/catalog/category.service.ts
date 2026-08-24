import { slugify } from '@lulwah/utils';
import type { Category, CategoryTreeNode } from '@lulwah/contracts';
import { AppError, notFoundError, validationError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as repo from './category.repository.js';
import { toCategoryDto, toCategoryTree } from './category.mapper.js';
import type { AdminCreateCategoryInput, AdminUpdateCategoryInput } from './category.dto.js';

function isDuplicateSlugError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

/** plan.md §9.2 `GET /categories/tree`. */
export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  const docs = await repo.listActiveTree();
  return toCategoryTree(docs);
}

export async function adminListCategories(actor: AuthenticatedUser, page: number, limit: number): Promise<{ categories: Category[]; total: number }> {
  assertPermission(actor, 'products.read');
  const { categories, total } = await repo.listAllCategories(page, limit);
  return { categories: categories.map(toCategoryDto), total };
}

export async function adminGetCategory(actor: AuthenticatedUser, id: string): Promise<Category> {
  assertPermission(actor, 'products.read');
  const doc = await repo.findCategoryById(id);
  if (!doc) throw notFoundError('Category not found.');
  return toCategoryDto(doc);
}

async function resolvePathAndLevel(parentId: string | null): Promise<{ path: string; level: number }> {
  if (!parentId) return { path: '', level: 0 };
  const parent = await repo.findCategoryById(parentId);
  if (!parent) throw validationError('parentId does not reference an existing category.', 'parentId');
  return { path: parent.path, level: parent.level + 1 };
}

export async function createCategory(actor: AuthenticatedUser, input: AdminCreateCategoryInput): Promise<Category> {
  assertPermission(actor, 'products.write');
  const slug = input.slug ?? slugify(input.name);
  const { path: parentPath, level } = await resolvePathAndLevel(input.parentId);
  const path = parentPath ? `${parentPath}/${slug}` : slug;

  try {
    const doc = await repo.createCategory({ ...input, slug, path, level });
    return toCategoryDto(doc);
  } catch (err) {
    if (isDuplicateSlugError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A category with this slug already exists.', field: 'slug' });
    throw err;
  }
}

/**
 * Renaming/reparenting a leaf category does NOT cascade a re-path to its
 * descendants in this phase — a deliberate scope cut (the locked §7.4
 * taxonomy is seeded once and rarely restructured after). Moving a
 * category with children would leave their `path`/`level` stale; treat
 * that as a known limitation, not a supported admin operation, until a
 * dedicated re-path job exists.
 */
export async function updateCategory(actor: AuthenticatedUser, id: string, input: AdminUpdateCategoryInput): Promise<Category> {
  assertPermission(actor, 'products.write');
  const existing = await repo.findCategoryById(id);
  if (!existing) throw notFoundError('Category not found.');

  const nextSlug = input.slug ?? existing.slug;
  const nextParentId = input.parentId !== undefined ? input.parentId : existing.parentId?.toString() ?? null;
  const { path: parentPath, level } = await resolvePathAndLevel(nextParentId);
  const path = parentPath ? `${parentPath}/${nextSlug}` : nextSlug;

  try {
    const doc = await repo.updateCategory(id, { ...input, slug: nextSlug, path, level });
    if (!doc) throw notFoundError('Category not found.');
    return toCategoryDto(doc);
  } catch (err) {
    if (isDuplicateSlugError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A category with this slug already exists.', field: 'slug' });
    throw err;
  }
}

export async function deleteCategory(actor: AuthenticatedUser, id: string): Promise<void> {
  assertPermission(actor, 'products.write');
  const deleted = await repo.softDeleteCategory(id);
  if (!deleted) throw notFoundError('Category not found.');
}
