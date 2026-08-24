import { Occasion } from '@lulwah/contracts';
import { getCategoryTree, listCollections } from './catalog-client';
import type { CategoryTreeNode } from './catalog-schemas';
import type { ListProductsParams } from './catalog-client';

/**
 * Resolves the PLP's `[...category]` catch-all path (`/shop/unstitched`,
 * `/shop/lawn-26-vol-1`, `/shop/eid`, ...) to the real filter that should
 * scope the listing. Every real link in this app (`Header`/`Footer`/`Hero`/
 * `ShopByStitching`/`OccasionTiles`/home rails/the `/collections` index) is
 * a single segment, so only the *last* segment is resolved — categories are
 * looked up by their own slug regardless of tree depth.
 *
 * Three kinds of segment exist, checked in order:
 * 1. Virtual segments with no matching category/collection at all — "sale"
 *    (→ `onSale: true`), "new-in" / "best-sellers" (→ `sort`).
 * 2. A real `Occasion` enum value (eid, mehndi, barat, walima, everyday, …).
 * 3. Anything else: checked against the real category tree and the real
 *    collections list — `/shop/lawn` resolves as a category, `/shop/
 *    lawn-26-vol-1` (the `/collections` index links here) as a collection.
 *
 * **Category resolution needs its own handling beyond `category:` param.**
 * `ListProductsQuery.category` resolves to exactly one category id and
 * `product.repository.ts#buildFilter` matches it with plain array-contains
 * equality — it does **not** walk descendants. But almost every real nav
 * link (`/shop/unstitched`, `/shop/pret`, `/shop/formal-wedding`) points at
 * a *parent* taxonomy node, and every seeded product is tagged with a
 * *leaf* category only (`categorySlug: 'lawn'`, never `'unstitched'`) — so
 * passing the parent's slug straight through as `category=` would silently
 * return zero results for most of the site's real navigation. Category
 * segments are therefore resolved to the **full set of descendant category
 * ids** (the matched node plus every child, recursively); `lib/plp-data.ts`
 * uses that id set to filter client-side rather than relying on the API's
 * single-id `category` param, which can't express "this node or below" in
 * one call.
 *
 * An unresolved segment (`resolved: false`) means the URL doesn't match
 * anything real — the PLP renders the empty-results state instead of
 * silently falling through to "no filter" (which would otherwise show the
 * *entire* catalogue for a typo'd or stale URL, a worse failure than an
 * honest zero).
 */
export interface ShopScope {
  filter: Pick<ListProductsParams, 'brand' | 'collection' | 'occasion' | 'onSale' | 'sort'>;
  /** Category ids to match a product against (the resolved node + every
   *  descendant) — `null` means "no category constraint at all." */
  categoryIds: string[] | null;
  resolved: boolean;
}

const VIRTUAL_SEGMENTS: Record<string, ShopScope['filter']> = {
  sale: { onSale: true },
  'new-in': { sort: 'newest' },
  'best-sellers': { sort: 'bestselling' },
};

const OCCASION_VALUES = new Set<string>(Occasion.options);

function findNodeBySlug(nodes: CategoryTreeNode[], slug: string): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const found = findNodeBySlug(node.children, slug);
    if (found) return found;
  }
  return null;
}

function collectSubtreeIds(node: CategoryTreeNode): string[] {
  return [node.id, ...node.children.flatMap(collectSubtreeIds)];
}

export async function resolveShopSegments(segments: string[]): Promise<ShopScope> {
  if (segments.length === 0) return { filter: {}, categoryIds: null, resolved: true };
  const last = segments[segments.length - 1] as string;

  const virtual = VIRTUAL_SEGMENTS[last];
  if (virtual) return { filter: virtual, categoryIds: null, resolved: true };

  if (OCCASION_VALUES.has(last)) {
    return { filter: { occasion: last as Occasion }, categoryIds: null, resolved: true };
  }

  const [tree, collections] = await Promise.all([getCategoryTree(), listCollections(100)]);

  const matchedCategory = findNodeBySlug(tree, last);
  if (matchedCategory) {
    return { filter: {}, categoryIds: collectSubtreeIds(matchedCategory), resolved: true };
  }
  if (collections.some((collection) => collection.slug === last)) {
    return { filter: { collection: last }, categoryIds: null, resolved: true };
  }

  return { filter: {}, categoryIds: null, resolved: false };
}
