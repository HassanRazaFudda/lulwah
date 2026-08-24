import { z } from 'zod';
import { objectId } from './common.js';
import { MediaRef } from './product.js';

/**
 * Category — plan.md §7.4. A tree: `parentId` links to the parent,
 * `path` is the materialized slug path (`unstitched/lawn`) so the storefront
 * can build breadcrumbs and filter queries without walking the tree at
 * request time, `level` is the depth (root = 0).
 */
export const Category = z.object({
  id: objectId,
  name: z.string(),
  nameAr: z.string(),
  slug: z.string(),
  parentId: objectId.nullable(),
  path: z.string(), // e.g. 'unstitched/lawn'
  level: z.number().int().nonnegative(),
  image: MediaRef.nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  showInMenu: z.boolean(),
  productCount: z.number().int().nonnegative(), // denormalised — not live-recomputed in this phase
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Category = z.infer<typeof Category>;

/** A `Category` plus its nested `children` — the shape `GET
 *  /categories/tree` returns (plan.md §9.2). Declared with `z.lazy` since
 *  the type is self-referential. */
export type CategoryTreeNode = Category & { children: CategoryTreeNode[] };
export const CategoryTreeNode: z.ZodType<CategoryTreeNode> = z.lazy(() =>
  Category.extend({ children: z.array(CategoryTreeNode) }),
);
