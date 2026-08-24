import { EventEmitter } from 'node:events';

/**
 * In-process domain events for `catalog` — plan.md §5.3 ("Publishes
 * events: `product.published`, `product.updated`, `collection.launched`")
 * and §5.5 (in-process bus for R1; a BullMQ `domain-events` queue for
 * anything with side effects). The Meilisearch-sync job
 * (`jobs/meilisearch-sync.job.ts`) subscribes to the two product events to
 * decide when to reindex/deindex a document — see that file.
 *
 * Both `product.published` and `product.updated` carry only `productId`,
 * not the product itself: the listener re-reads the current row before
 * indexing, which is what lets ONE handler serve "reindex" (still active)
 * and "remove from index" (now unpublished/archived/deleted) without two
 * separate event names — see that file's doc comment for the full
 * reasoning.
 */
export interface CatalogEventMap {
  'product.published': { productId: string };
  'product.updated': { productId: string };
  'collection.launched': { collectionId: string };
}

class CatalogEventBus extends EventEmitter {
  publish<K extends keyof CatalogEventMap>(event: K, payload: CatalogEventMap[K]): void {
    this.emit(event, payload);
  }

  subscribe<K extends keyof CatalogEventMap>(event: K, handler: (payload: CatalogEventMap[K]) => void): void {
    this.on(event, handler);
  }
}

export const catalogEvents = new CatalogEventBus();
