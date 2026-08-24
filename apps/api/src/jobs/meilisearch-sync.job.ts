import type { Queue } from 'bullmq';
import { catalogEvents } from '../modules/catalog/catalog.events.js';
import { syncProductToIndex } from '../modules/catalog/search.service.js';

/**
 * Bridges `catalog`'s in-process event bus onto the shared BullMQ
 * `domain-events` queue (plan.md §5.5: "Placing an order does not wait on
 * an email send" — the same rule applies to reindexing: publishing a
 * product must not block the HTTP response on a Meilisearch round trip).
 * Call `registerMeilisearchSyncOnQueue` once at boot, from `server.ts` —
 * never from `app.ts`, which `mongodb-memory-server` integration tests
 * import without any Redis running (see `domain-events.queue.ts`'s doc
 * comment on why the queue is a factory, not a top-level singleton).
 */
export const MEILISEARCH_SYNC_JOB_NAME = 'catalog.sync-product';

export interface MeilisearchSyncJobData {
  productId: string;
}

export function registerMeilisearchSyncOnQueue(queue: Queue): void {
  const enqueue = (productId: string): void => {
    // Fire-and-forget from the event handler's perspective — the queue
    // add itself is async, but nothing here awaits it (there is no
    // request in flight to hold open).
    void queue.add(MEILISEARCH_SYNC_JOB_NAME, { productId } satisfies MeilisearchSyncJobData);
  };
  catalogEvents.subscribe('product.published', ({ productId }) => enqueue(productId));
  catalogEvents.subscribe('product.updated', ({ productId }) => enqueue(productId));
}

/** `worker.ts`'s dispatch table entry for this job name — see that file
 *  for the generic `processJob(job)` it's wired into. */
export async function processMeilisearchSyncJob(data: unknown): Promise<void> {
  const productId = (data as Partial<MeilisearchSyncJobData>).productId;
  if (typeof productId !== 'string') return;
  await syncProductToIndex(productId);
}
