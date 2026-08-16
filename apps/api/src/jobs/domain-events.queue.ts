import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../shared/env.js';
import { logger } from '../shared/logger.js';

/**
 * plan.md §5.5: "In-process EventEmitter for R1, published to a BullMQ
 * `domain-events` queue for anything with side effects (email, webhook,
 * analytics, cache invalidation)." Only `identity.events.ts`'s in-process
 * bus is wired up today — nothing publishes onto this queue yet — but the
 * queue + a no-op worker exist so the next module that needs a
 * side-effect job has somewhere to put it instead of inventing its own.
 *
 * Both are factories, not top-level singletons: importing this module
 * must never open a Redis connection as a side effect (integration tests
 * import the identity module — and transitively `app.ts` — without any
 * Redis running at all).
 */
export const DOMAIN_EVENTS_QUEUE_NAME = 'domain-events';

/** BullMQ requires its own connection with `maxRetriesPerRequest: null`
 *  — the general-purpose client in `shared/redis.ts` sets a finite retry
 *  count for the rate limiter's sake, so it can't be reused here. */
function createBullConnection(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export function createDomainEventsQueue(connection: Redis = createBullConnection()): Queue {
  return new Queue(DOMAIN_EVENTS_QUEUE_NAME, { connection });
}

/** No-op processor stub. Real handlers get registered per plan.md §5.5 as
 *  each side-effect-owning module (email, webhook, analytics, cache
 *  invalidation) lands — this just keeps `worker.ts` bootable today. */
export function createDomainEventsWorker(connection: Redis = createBullConnection()): Worker {
  return new Worker(
    DOMAIN_EVENTS_QUEUE_NAME,
    async (job) => {
      logger.info({ jobId: job.id, jobName: job.name }, 'domain-events: no-op stub processor');
    },
    { connection },
  );
}
