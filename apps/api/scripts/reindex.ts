/**
 * `pnpm reindex` — a full Meilisearch rebuild from Mongo, called out by
 * name in plan.md §7.14. Applies the index settings (searchable/
 * filterable/sortable attributes, ranking rules, synonyms) and then
 * upserts every currently-`active` product. Safe to re-run any time: both
 * `ensureSettings()` and `upsert()` are idempotent.
 */
import { connect, disconnect } from '../src/shared/mongo.js';
import { logger } from '../src/shared/logger.js';
import { fullReindex } from '../src/modules/catalog/search.service.js';

async function main(): Promise<void> {
  await connect();
  logger.info('reindex: connected to MongoDB, rebuilding the Meilisearch products index...');
  const { indexed } = await fullReindex();
  logger.info({ indexed }, 'reindex: done');
  await disconnect();
}

main().catch((err: unknown) => {
  logger.error({ err }, 'reindex failed');
  process.exit(1);
});
