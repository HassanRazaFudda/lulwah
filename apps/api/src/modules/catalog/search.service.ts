import type { Product, SearchQueryRow } from '@lulwah/contracts';
import { logger } from '../../shared/logger.js';
import { meiliSearchIndexPort } from '../../integrations/meilisearch/search-index-port.js';
import type { SearchIndexPort } from '../../integrations/meilisearch/search-index-port.js';
import type { ProductSearchDocument } from '../../integrations/meilisearch/product-document.js';
import * as brandRepo from './brand.repository.js';
import * as categoryRepo from './category.repository.js';
import * as productRepo from './product.repository.js';
import * as variantRepo from './variant.repository.js';
import * as searchQueryRepo from './search-query.repository.js';
import type { SearchQueryAggregateRow } from './search-query.repository.js';
import { toProductDto } from './product.mapper.js';

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Only `status: active` products are ever indexed — an unpublished,
 *  archived or hard-deleted product simply has no document, which is what
 *  `syncProductToIndex` uses to decide "upsert" vs. "remove" from one code
 *  path (see `catalog.events.ts`'s doc comment on why both
 *  `product.published`/`product.updated` route here identically). */
async function buildSearchDocument(productId: string): Promise<ProductSearchDocument | null> {
  const product = await productRepo.findProductById(productId);
  if (!product || product.status !== 'active') return null;

  const [brand, category, variants] = await Promise.all([
    brandRepo.findBrandById(product.brandId.toString()),
    categoryRepo.findCategoryById(product.primaryCategoryId.toString()),
    variantRepo.findVariantsByProductId(productId),
  ]);

  const sizes = Array.from(new Set(variants.map((v) => v.options.size).filter((size): size is NonNullable<typeof size> => Boolean(size))));

  return {
    id: product._id.toString(),
    articleCode: product.articleCode,
    title: product.title,
    titleAr: product.titleAr,
    brandId: product.brandId.toString(),
    brandName: brand?.name ?? '',
    colorName: product.colorName,
    colorFamily: product.colorFamily,
    fabric: product.fabric,
    categoryIds: product.categoryIds.map((id) => id.toString()),
    categoryPath: category?.path ?? '',
    collectionIds: product.collectionIds.map((id) => id.toString()),
    stitchingType: product.stitchingType,
    pieceCount: product.pieceCount,
    work: product.work,
    occasion: product.occasion,
    season: product.season,
    size: sizes,
    effectivePriceFils: product.effectivePriceFils,
    discountPercent: product.discountPercent,
    onSale: product.discountPercent > 0,
    inStock: product.inStock,
    status: product.status,
    createdAt: product.createdAt.getTime(),
    soldCount: product.soldCount,
  };
}

/** Reindexes (or removes) exactly one product — the handler
 *  `jobs/meilisearch-sync.job.ts` runs for every `product.published`/
 *  `product.updated` event (plan.md §7.14). Never throws: this runs inside
 *  a background job already isolated from the request path, but a search
 *  outage still must not crash the worker or retry-storm indefinitely. */
export async function syncProductToIndex(productId: string, port: SearchIndexPort = meiliSearchIndexPort): Promise<void> {
  try {
    const doc = await buildSearchDocument(productId);
    if (doc) await port.upsert(doc);
    else await port.remove(productId);
  } catch (err) {
    logger.error({ err, productId }, 'meilisearch sync failed');
  }
}

export interface SearchProductsResult {
  products: Product[];
  source: 'meilisearch' | 'mongo_fallback';
}

/** Fire-and-forget: the Reports screen's Search category (plan.md §11.1)
 *  needs real query data, but logging must never be able to slow down or
 *  break `GET /search` itself (same "search must never 500" rule §7.14
 *  states for the search backend itself — applied here to its own
 *  logging). Never awaited by the caller; failures are swallowed, not
 *  thrown. Blank queries are already filtered out by `searchProducts`
 *  before this is reached. */
function logSearchQueryFireAndForget(query: string, resultCount: number, source: SearchProductsResult['source']): void {
  searchQueryRepo.logSearchQuery({ query, resultCount, source }).catch((err: unknown) => {
    logger.warn({ err }, 'search query logging failed (non-fatal — plan.md §11.1 report data will just be missing this one)');
  });
}

/** plan.md §9.2 `GET /search` + §7.14's explicit rule: "If Meilisearch is
 *  unreachable the API falls back to a Mongo regex query on `title` +
 *  `articleCode` — degraded, but search never returns a 500." */
export async function searchProducts(query: string, limit: number, port: SearchIndexPort = meiliSearchIndexPort): Promise<SearchProductsResult> {
  const trimmed = query.trim();
  if (!trimmed) return { products: [], source: 'meilisearch' };

  try {
    const ids = await port.search(trimmed, limit);
    if (ids.length === 0) {
      logSearchQueryFireAndForget(trimmed, 0, 'meilisearch');
      return { products: [], source: 'meilisearch' };
    }
    const docs = await productRepo.findProductsByIds(ids);
    const byId = new Map(docs.map((doc) => [doc._id.toString(), doc]));
    // Preserve Meilisearch's own ranking order, not Mongo's natural order.
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((doc): doc is NonNullable<typeof doc> => doc !== undefined && doc.status === 'active');
    logSearchQueryFireAndForget(trimmed, ordered.length, 'meilisearch');
    return { products: ordered.map((doc) => toProductDto(doc)), source: 'meilisearch' };
  } catch (err) {
    logger.warn({ err }, 'meilisearch search failed — falling back to Mongo regex (plan.md §7.14)');
    const regex = new RegExp(escapeRegExp(trimmed), 'i');
    const docs = await productRepo.searchProductsMongoFallback(regex, limit);
    logSearchQueryFireAndForget(trimmed, docs.length, 'mongo_fallback');
    return { products: docs.map((doc) => toProductDto(doc)), source: 'mongo_fallback' };
  }
}

function toSearchQueryRow(row: SearchQueryAggregateRow): SearchQueryRow {
  return { query: row.sampleQuery, searchCount: row.searchCount, avgResultCount: row.avgResultCount, lastSearchedAt: row.lastSearchedAt };
}

/** `report` module's Search report (plan.md §11.1) — `catalog`'s exported
 *  seam over the `search_queries` log this file writes to above, so
 *  `report` never touches `SearchQueryLogModel` directly (plan.md §5.3). */
export async function getTopSearchQueries(dateFrom: Date | undefined, dateTo: Date | undefined, limit: number): Promise<SearchQueryRow[]> {
  const rows = await searchQueryRepo.aggregateTopQueries(dateFrom, dateTo, limit);
  return rows.map(toSearchQueryRow);
}

export async function getZeroResultSearchQueries(dateFrom: Date | undefined, dateTo: Date | undefined, limit: number): Promise<SearchQueryRow[]> {
  const rows = await searchQueryRepo.aggregateZeroResultQueries(dateFrom, dateTo, limit);
  return rows.map(toSearchQueryRow);
}

/** `pnpm reindex` (`scripts/reindex.ts`) — a full rebuild from Mongo,
 *  called out by name in plan.md §7.14. */
export async function fullReindex(port: SearchIndexPort = meiliSearchIndexPort): Promise<{ indexed: number }> {
  await port.ensureSettings();
  const productIds = await productRepo.listAllActiveProductIds();
  let indexed = 0;
  for (const productId of productIds) {
    const doc = await buildSearchDocument(productId);
    if (doc) {
      await port.upsert(doc);
      indexed += 1;
    }
  }
  return { indexed };
}
