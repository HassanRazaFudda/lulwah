/**
 * `node dist/scripts/migrate.js` — the exact deploy-time migration step
 * `plan.md` §36.9's own `scripts/deploy.sh` already names: `docker compose
 * ... run --rm api node dist/scripts/migrate.js`, run once per deploy,
 * before the rolling app restart. This file is what makes that line real —
 * it didn't exist anywhere in the repo before (see `docs/implemented-plan
 * .md` §8.15 for the bug that surfaced the gap: every unique index in the
 * system was silently unenforced on every real environment, including
 * local dev, because `shared/mongo.ts`'s `autoIndex: false` needs exactly
 * this kind of explicit step and nothing ever ran it outside a test
 * suite's own setup).
 *
 * Lives under `src/scripts/`, not the sibling top-level `scripts/`
 * directory (`seed.ts`/`reindex.ts`/`mongo-init.js`) — those are dev-only
 * tools, always run via `tsx` directly against source, and typechecked
 * (never built) via `tsconfig.scripts.json`. This file, uniquely, needs to
 * exist as real compiled JS in a real deploy, and the only tsc config that
 * actually emits (`tsconfig.json`, `include: ["src"]`, `rootDir: "src"`)
 * only ever covers `src/`. Living here means it compiles to
 * `dist/scripts/migrate.js` for free, with its relative imports resolving
 * correctly against the rest of `dist/` — no second build step, no
 * separate tsconfig, no path-rewriting.
 *
 * Today this is index-syncing only — there is no schema-migration
 * framework in this codebase (no versioned migration files, no "up/down"
 * runner). If/when a real breaking schema change needs one (a field
 * rename, a backfill), add it as its own step in `main()` below, run
 * before the index sync — this file is the one place `plan.md`'s deploy
 * script already expects to find it.
 *
 * Imports every model file so each one registers with Mongoose (import
 * order/completeness matters — a model file not imported below silently
 * keeps its indexes unbuilt), then calls `syncIndexes()` on each. Safe to
 * re-run any time — `syncIndexes()` only creates/drops what's actually out
 * of sync with each schema's current `.index()` declarations.
 *
 * Also runnable directly in local dev as `pnpm db:sync-indexes` (same
 * file, a friendlier name for the common case of "I just want indexes
 * synced," see `package.json`) — run it after `pnpm seed` on a fresh
 * environment, and again after any schema index change.
 */
import mongoose from 'mongoose';
import { connect, disconnect } from '../shared/mongo.js';
import { logger } from '../shared/logger.js';

import '../modules/audit/audit.model.js';
import '../modules/cart/cart.model.js';
import '../modules/catalog/brand.model.js';
import '../modules/catalog/category.model.js';
import '../modules/catalog/collection.model.js';
import '../modules/catalog/product.model.js';
import '../modules/catalog/search-query.model.js';
import '../modules/catalog/variant.model.js';
import '../modules/checkout/checkout.model.js';
import '../modules/content/banner.model.js';
import '../modules/content/home-section.model.js';
import '../modules/content/media-asset.model.js';
import '../modules/content/menu.model.js';
import '../modules/content/page.model.js';
import '../modules/identity/address.model.js';
import '../modules/identity/identity.model.js';
import '../modules/inventory/inventory-item.model.js';
import '../modules/inventory/stock-movement.model.js';
import '../modules/order/order.model.js';
import '../modules/payment/cod-otp.model.js';
import '../modules/payment/webhook-event.model.js';
import '../modules/pricing/discount.model.js';
import '../modules/settings/settings.model.js';

async function main(): Promise<void> {
  await connect();
  logger.info('migrate: connected to MongoDB');

  const modelNames = mongoose.modelNames();
  logger.info({ count: modelNames.length, models: modelNames }, 'migrate: syncing indexes for every registered model');

  for (const name of modelNames) {
    const result = await mongoose.model(name).syncIndexes();
    logger.info({ model: name, result }, 'migrate: synced');
  }

  await disconnect();
  logger.info('migrate: done');
}

main().catch((err: unknown) => {
  logger.error({ err }, 'migrate failed');
  process.exit(1);
});
