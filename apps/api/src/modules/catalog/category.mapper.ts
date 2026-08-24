import type { Category, CategoryTreeNode } from '@lulwah/contracts';
import type { CategoryDoc, CategoryHydratedDoc } from './category.model.js';
import { toMediaRefDto } from './media.mapper.js';

export function toCategoryDto(doc: CategoryDoc | CategoryHydratedDoc): Category {
  return {
    id: doc._id.toString(),
    name: doc.name,
    nameAr: doc.nameAr,
    slug: doc.slug,
    parentId: doc.parentId ? doc.parentId.toString() : null,
    path: doc.path,
    level: doc.level,
    image: toMediaRefDto(doc.image),
    sortOrder: doc.sortOrder,
    isActive: doc.isActive,
    showInMenu: doc.showInMenu,
    productCount: doc.productCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Nests a flat, `level`-ordered list of categories into a tree — the
 *  shape `GET /categories/tree` returns (plan.md §9.2). One pass since the
 *  list is already ordered parent-before-child by `level`. */
export function toCategoryTree(docs: readonly (CategoryDoc | CategoryHydratedDoc)[]): CategoryTreeNode[] {
  const nodesById = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  for (const doc of docs) {
    nodesById.set(doc._id.toString(), { ...toCategoryDto(doc), children: [] });
  }
  for (const doc of docs) {
    const node = nodesById.get(doc._id.toString());
    if (!node) continue;
    const parentId = doc.parentId?.toString();
    const parent = parentId ? nodesById.get(parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
