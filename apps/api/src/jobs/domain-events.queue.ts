import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../shared/env.js';
import { logger } from '../shared/logger.js';

/**
 * plan.md §5.5: "In-process EventEmitter for R1, published to a BullMQ
 * `domain-events` queue for anything with side effects (email, webhook,
 * analytics, cache invalidation)." `catalog`'s Meilisearch sync
 * (`jobs/meilisearch-sync.job.ts`) is the first real consumer — it
 * subscribes to `catalog.events.ts` and enqueues onto this same shared
 * queue, and `processJob` below is where `worker.ts` dispatches an
 * incoming job by name to that handler.
 *
 * Both factories, not top-level singletons: importing this module must
 * never open a Redis connection as a side effect (integration tests import
 * `app.ts`, which never touches this file, but a future test importing a
 * module that does must not need a live Redis just to load it).
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

async function defaultNoOpProcessor(job: Job): Promise<void> {
  logger.info({ jobId: job.id, jobName: job.name }, 'domain-events: no registered handler for this job name');
}

/** `processJob` defaults to a no-op logger so `worker.ts` stays bootable
 *  even before any module registers a real handler — pass a dispatch
 *  function (job name → handler) once one exists, per plan.md §5.5. */
export function createDomainEventsWorker(processJob: (job: Job) => Promise<void> = defaultNoOpProcessor, connection: Redis = createBullConnection()): Worker {
  return new Worker(DOMAIN_EVENTS_QUEUE_NAME, processJob, { connection });
}
