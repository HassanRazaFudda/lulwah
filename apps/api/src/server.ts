import { createApp } from './app.js';
import { env } from './shared/env.js';
import { logger } from './shared/logger.js';
import { connect as connectMongo } from './shared/mongo.js';
import { connect as connectRedis } from './shared/redis.js';
import { RedisRateLimitStore } from './shared/rate-limit.js';
import { RedisReservationStore } from './modules/cart/reservation-store.js';
import { createDomainEventsQueue } from './jobs/domain-events.queue.js';
import { registerMeilisearchSyncOnQueue } from './jobs/meilisearch-sync.job.js';
import { registerReservationSweepOnQueue } from './jobs/reservation-sweep.job.js';

/**
 * Boots the HTTP API. Connects to Mongo/Redis first and lets a failure
 * there crash the process before it ever binds a port — a container that
 * starts serving traffic against a broken datastore connection is worse
 * than one that never starts (plan.md §25.3's "crashes the container at
 * startup, not at 2 a.m." applies here too, not just to bad env vars).
 */
async function main(): Promise<void> {
  await connectMongo();
  const redis = connectRedis();
  const app = createApp({ rateLimitStore: new RedisRateLimitStore(redis), reservationStore: new RedisReservationStore(redis) });

  // Bridges `catalog`'s in-process events onto the BullMQ `domain-events`
  // queue (plan.md §5.5) — only done here, in the real boot path, never in
  // `app.ts` (imported by integration tests with no live Redis).
  registerMeilisearchSyncOnQueue(createDomainEventsQueue());
  // plan.md §8.4: schedules the 60s reservation-sweep repeatable job. Only
  // the `WORKER=true` process (`worker.ts`) actually processes it — this
  // just makes sure the schedule exists, same as any other repeatable job.
  await registerReservationSweepOnQueue(createDomainEventsQueue());

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'api listening');
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, 'failed to boot api');
  process.exit(1);
});
