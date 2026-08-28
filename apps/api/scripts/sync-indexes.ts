/**
 * `pnpm db:sync-indexes` — the migration step `shared/mongo.ts`'s own doc
 * comment on `autoIndex: false` promises exists ("indexes are created by
 * a migration step at deploy time, never implicitly by Mongoose"), but
 * which nothing in this repo actually ran outside of each integration
 * test suite's own `Model.syncIndexes()` call in its setup. Found while
 * verifying the P3 Discounts screen: three discounts were created with
 * the identical code `INFLU0002` with no rejection, because
 * `{ code: 1 }`'s declared `unique: true` index (`discount.model.ts`)
 * was never actually built on the local dev database — `autoIndex: false`
 * means Mongoose never builds it on connect, by design, and there was no
 * other place it would get built. Every unique index in the system
 * (users.email, orders.orderNumber/idempotencyKey, discounts.code, …) was
 * silently unenforced the same way, not just this one — this script is
 * the fix for the whole class, not a one-off patch for discounts.
 *
 * Imports every model file so each one registers with Mongoose (import
 * order/completeness matters here — a model file not imported below
 * would silently keep its indexes unbuilt), then calls `syncIndexes()`
 * on each registered model. Safe to re-run any time — `syncIndexes()` is
 * idempotent, only creating/dropping what's actually out of sync with
 * each schema's current `.index()` declarations. Run this after `pnpm
 * seed` on a fresh environment, and again after any schema index change.
 */
import mongoose from 'mongoose';
import { connect, disconnect } from '../src/shared/mongo.js';
import { logger } from '../src/shared/logger.js';

import '../src/modules/audit/audit.model.js';
import '../src/modules/cart/cart.model.js';
import '../src/modules/catalog/brand.model.js';
import '../src/modules/catalog/category.model.js';
import '../src/modules/catalog/collection.model.js';
import '../src/modules/catalog/product.model.js';
import '../src/modules/catalog/search-query.model.js';
import '../src/modules/catalog/variant.model.js';
import '../src/modules/checkout/checkout.model.js';
import '../src/modules/content/banner.model.js';
import '../src/modules/content/home-section.model.js';
import '../src/modules/content/media-asset.model.js';
import '../src/modules/content/menu.model.js';
import '../src/modules/content/page.model.js';
import '../src/modules/identity/address.model.js';
import '../src/modules/identity/identity.model.js';
import '../src/modules/inventory/inventory-item.model.js';
import '../src/modules/inventory/stock-movement.model.js';
import '../src/modules/order/order.model.js';
import '../src/modules/payment/cod-otp.model.js';
import '../src/modules/payment/webhook-event.model.js';
import '../src/modules/pricing/discount.model.js';
import '../src/modules/settings/settings.model.js';

async function main(): Promise<void> {
  await connect();
  logger.info('db:sync-indexes: connected to MongoDB');

  const modelNames = mongoose.modelNames();
  logger.info({ count: modelNames.length, models: modelNames }, 'db:sync-indexes: syncing indexes for every registered model');

  for (const name of modelNames) {
    const result = await mongoose.model(name).syncIndexes();
    logger.info({ model: name, result }, 'db:sync-indexes: synced');
  }

  await disconnect();
  logger.info('db:sync-indexes: done');
}

main().catch((err: unknown) => {
  logger.error({ err }, 'db:sync-indexes failed');
  process.exit(1);
});
