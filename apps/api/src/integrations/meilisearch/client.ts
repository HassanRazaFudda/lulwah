import { Meilisearch } from 'meilisearch';
import { env } from '../../shared/env.js';

/** All indices this API owns are prefixed so dev/staging/prod (or several
 *  developers pointed at one shared Meilisearch) never collide — mirrors
 *  `env.MEILI_INDEX_PREFIX`'s existing `dev_` default. */
export const PRODUCTS_INDEX_UID = `${env.MEILI_INDEX_PREFIX}products`;

let cachedClient: Meilisearch | null | undefined;

/**
 * Lazily constructed, memoized singleton. Returns `null` — not a thrown
 * error — when `MEILI_HOST` is unset, which is a valid runtime state (plan.md
 * §7.14: search must degrade gracefully, never crash boot over a missing
 * search backend). Every caller in this module treats `null` as "skip the
 * search-index side effect" or "fall back to Mongo", never as a bug.
 */
export function getMeiliClient(): Meilisearch | null {
  if (cachedClient !== undefined) return cachedClient;
  cachedClient = env.MEILI_HOST ? new Meilisearch({ host: env.MEILI_HOST, ...(env.MEILI_MASTER_KEY ? { apiKey: env.MEILI_MASTER_KEY } : {}) }) : null;
  return cachedClient;
}

/** Test-only: clears the memoized client so a test can flip
 *  `MEILI_HOST`/mock fetch between cases. Not used by production code. */
export function resetMeiliClientForTests(): void {
  cachedClient = undefined;
}
