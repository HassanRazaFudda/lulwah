import { getMeiliClient, PRODUCTS_INDEX_UID } from './client.js';
import { PRODUCTS_INDEX_SETTINGS } from './index-config.js';
import type { ProductSearchDocument } from './product-document.js';

/**
 * The seam between `catalog/search.service.ts` and the real Meilisearch
 * SDK — tests inject a fake implementation of this interface instead of
 * needing a live Meilisearch instance (the brief: "can mock/stub
 * Meilisearch if a real instance isn't available ... don't make tests
 * hard-depend on Docker being up").
 */
export interface SearchIndexPort {
  upsert(doc: ProductSearchDocument): Promise<void>;
  remove(productId: string): Promise<void>;
  /** Returns product ids in Meilisearch's own ranked order. Throws on any
   *  failure (unreachable host, index missing, etc.) — the caller
   *  (`search.service.ts#searchProducts`) is what catches it and falls
   *  back to Mongo, per plan.md §7.14's "search never returns a 500". */
  search(query: string, limit: number): Promise<string[]>;
  ensureSettings(): Promise<void>;
}

export const meiliSearchIndexPort: SearchIndexPort = {
  async upsert(doc) {
    const client = getMeiliClient();
    if (!client) return;
    await client.index(PRODUCTS_INDEX_UID).addDocuments([doc], { primaryKey: 'id' });
  },

  async remove(productId) {
    const client = getMeiliClient();
    if (!client) return;
    await client.index(PRODUCTS_INDEX_UID).deleteDocument(productId);
  },

  async search(query, limit) {
    const client = getMeiliClient();
    if (!client) throw new Error('Meilisearch is not configured (MEILI_HOST unset).');
    // Only `status: active` products are indexed at all (see
    // `catalog/search.service.ts#buildSearchDocument`), so this filter is
    // belt-and-braces against a stale document from before an unpublish.
    const result = await client.index(PRODUCTS_INDEX_UID).search(query, { filter: 'status = active', limit });
    return result.hits.map((hit: Record<string, unknown>) => hit.id as string);
  },

  async ensureSettings() {
    const client = getMeiliClient();
    if (!client) return;
    await client.index(PRODUCTS_INDEX_UID).updateSettings(PRODUCTS_INDEX_SETTINGS);
  },
};
