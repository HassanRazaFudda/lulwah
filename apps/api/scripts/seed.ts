/**
 * Seed script — TODO, documented stub. Per the brief for this skeleton:
 * depth here matters less than the auth module being correct and tested.
 *
 * Once `catalog`/`pricing`/`order` exist, this should create: a
 * `super_admin` user (so there's a way into `/admin/*` on a fresh
 * environment without a manual `mongosh` insert), a handful of sample
 * products spanning the §2 attribute space (stitching type, fabric,
 * work, occasion), a discount code, and a couple of orders across
 * different §8.7 statuses — so `pnpm dev` has something to look at
 * immediately instead of an empty database.
 *
 * Today it only proves the Mongo connection wiring works end to end.
 */
import { connect, disconnect } from '../src/shared/mongo.js';
import { logger } from '../src/shared/logger.js';

async function main(): Promise<void> {
  await connect();
  logger.info('seed: connected to MongoDB. No seed data defined yet — see the TODO at the top of this file.');
  await disconnect();
}

main().catch((err: unknown) => {
  logger.error({ err }, 'seed failed');
  process.exit(1);
});
