/**
 * The `products` Meilisearch index configuration — plan.md §7.14, used
 * verbatim as specified there. Applied by `ensureSettings()`
 * (`search-index-port.ts`), called from `pnpm reindex`
 * (`scripts/reindex.ts`) and safe to re-run any time (Meilisearch's
 * `updateSettings` is idempotent).
 */
export const PRODUCTS_INDEX_SETTINGS = {
  searchableAttributes: ['articleCode', 'title', 'titleAr', 'brandName', 'colorName', 'fabric', 'categoryPath', 'occasion'],
  filterableAttributes: [
    'brandId',
    'categoryIds',
    'collectionIds',
    'stitchingType',
    'pieceCount',
    'fabric',
    'work',
    'occasion',
    'season',
    'colorFamily',
    'size',
    'effectivePriceFils',
    'inStock',
    'onSale',
    'status',
  ],
  sortableAttributes: ['effectivePriceFils', 'createdAt', 'soldCount', 'discountPercent'],
  rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness', 'soldCount:desc'],
  synonyms: {
    '3 piece': ['three piece', '3pc', '3-piece'],
    unstitched: ['un-stitched', 'unstiched'],
    lawn: ['lawn suit'],
    dupatta: ['dupata', 'chunri'],
  },
};
