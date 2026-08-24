import type { ColorFamily, Fabric, Occasion, Product, Size, StitchingType, Work } from '@lulwah/contracts';
import { listProducts, type ListProductsParams, type ProductSort } from './catalog-client';
import type { ShopScope } from './shop-segment';

/** ListProductsQuery's own cap (`product.dto.ts`). */
const MAX_LIMIT = 100;
const PAGE_SIZE = 6;

export interface PlpFacetSelections {
  stitchingType?: StitchingType;
  brand?: string;
  fabric?: Fabric;
  occasion?: Occasion;
  work?: Work;
  colorFamily?: ColorFamily;
  size?: Size;
  minPriceFils?: number;
  maxPriceFils?: number;
  inStock?: boolean;
  onSale?: boolean;
  sort?: ProductSort;
}

export interface PlpData {
  /** The category/collection/occasion-scoped set, unfiltered by the
   *  user's own facet picks — used for facet option counts + price range. */
  scopeProducts: Product[];
  /** The final, paginated, fully-filtered result set to render. */
  displayProducts: Product[];
  total: number;
  hasMore: boolean;
}

function selectionsToParams(selections: PlpFacetSelections): Partial<ListProductsParams> {
  return {
    ...(selections.stitchingType ? { stitchingType: selections.stitchingType } : {}),
    ...(selections.brand ? { brand: selections.brand } : {}),
    ...(selections.fabric ? { fabric: selections.fabric } : {}),
    ...(selections.occasion ? { occasion: selections.occasion } : {}),
    ...(selections.work ? { work: selections.work } : {}),
    ...(selections.colorFamily ? { colorFamily: selections.colorFamily } : {}),
    ...(selections.size ? { size: selections.size } : {}),
    ...(selections.minPriceFils !== undefined ? { minPrice: selections.minPriceFils } : {}),
    ...(selections.maxPriceFils !== undefined ? { maxPrice: selections.maxPriceFils } : {}),
    ...(selections.inStock !== undefined ? { inStock: selections.inStock } : {}),
    ...(selections.onSale !== undefined ? { onSale: selections.onSale } : {}),
    ...(selections.sort ? { sort: selections.sort } : {}),
  };
}

function matchesCategoryIds(product: Product, categoryIdSet: Set<string>): boolean {
  return categoryIdSet.has(product.primaryCategoryId) || product.categoryIds.some((id) => categoryIdSet.has(id));
}

/**
 * Loads everything the PLP needs for one render: the facet-count pool and
 * the final paginated result set. Two paths, chosen by whether the
 * resolved scope carries a category constraint (`shop-segment.ts`):
 *
 * - **No category constraint** (brand/occasion/sale/unfiltered/collection):
 *   the API does real server-side filtering + pagination — `page`/`limit`
 *   map onto `ListProductsQuery` directly (via the "load more accumulates"
 *   `limit = page * PAGE_SIZE` trick, see the inline comment below).
 * - **Category constraint present**: `ListProductsQuery.category` only
 *   exact-matches one category id (`product.repository.ts#buildFilter`),
 *   but a resolved segment can carry many ids (a parent category + all its
 *   descendants — see `shop-segment.ts`'s doc comment for why this is the
 *   *common* case, not an edge case: `/shop/unstitched`, `/shop/pret` and
 *   `/shop/formal-wedding` are all parent nodes). The API has no way to
 *   OR multiple category ids in one call, so this path fetches every
 *   product matching the *other* filters (`limit: 100`, comfortably the
 *   whole 33-product seeded catalogue) and filters/paginates the category
 *   constraint client-side instead — the same cumulative-slice approach
 *   the placeholder version used for everything.
 */
export async function loadPlpData(scope: ShopScope, selections: PlpFacetSelections, page: number): Promise<PlpData> {
  const baseParams = scope.filter;

  if (scope.categoryIds && scope.categoryIds.length > 0) {
    const categoryIdSet = new Set(scope.categoryIds);

    const [scopePool, displayPool] = await Promise.all([
      listProducts({ ...baseParams, limit: MAX_LIMIT }),
      listProducts({ ...baseParams, ...selectionsToParams(selections), limit: MAX_LIMIT }),
    ]);

    const scopeProducts = scopePool.products.filter((p) => matchesCategoryIds(p, categoryIdSet));
    const filtered = displayPool.products.filter((p) => matchesCategoryIds(p, categoryIdSet));
    const visibleCount = Math.min(page * PAGE_SIZE, filtered.length);

    return {
      scopeProducts,
      displayProducts: filtered.slice(0, visibleCount),
      total: filtered.length,
      hasMore: visibleCount < filtered.length,
    };
  }

  const [scopeResult, displayResult] = await Promise.all([
    listProducts({ ...baseParams, limit: MAX_LIMIT }),
    listProducts({
      ...baseParams,
      ...selectionsToParams(selections),
      page: 1,
      // "Load more" accumulates rather than paginates (plan.md §15.3: real
      // ?page= URLs, but rendered cumulatively) — asking for `page *
      // PAGE_SIZE` items in one page-1 call reproduces that.
      limit: Math.min(page * PAGE_SIZE, MAX_LIMIT),
    }),
  ]);

  return {
    scopeProducts: scopeResult.products,
    displayProducts: displayResult.products,
    total: displayResult.total,
    hasMore: displayResult.hasMore,
  };
}
