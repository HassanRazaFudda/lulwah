import type { Job } from 'bullmq';
import { env } from './shared/env.js';
import { logger } from './shared/logger.js';
import { connect as connectMongo } from './shared/mongo.js';
import { connect as connectRedis } from './shared/redis.js';
import { RedisReservationStore } from './modules/cart/reservation-store.js';
import { createDomainEventsWorker } from './jobs/domain-events.queue.js';
import { MEILISEARCH_SYNC_JOB_NAME, processMeilisearchSyncJob } from './jobs/meilisearch-sync.job.js';
import { RESERVATION_SWEEP_JOB_NAME, processReservationSweepJob } from './jobs/reservation-sweep.job.js';

/** Job name → handler dispatch table (plan.md §5.5). More side-effect
 *  handlers (email, webhook, analytics, cache invalidation) land here as
 *  the modules that own them are built. */
function createDomainEventJobProcessor(reservationStore: InstanceType<typeof RedisReservationStore>) {
  return async function processDomainEventJob(job: Job): Promise<void> {
    if (job.name === MEILISEARCH_SYNC_JOB_NAME) {
      await processMeilisearchSyncJob(job.data as unknown);
      return;
    }
    if (job.name === RESERVATION_SWEEP_JOB_NAME) {
      await processReservationSweepJob(reservationStore);
      return;
    }
    logger.warn({ jobId: job.id, jobName: job.name }, 'domain-events: no registered handler for this job name');
  };
}

/**
 * Boots the BullMQ worker process — a separate container from the API
 * (plan.md §5.6: "Baseline: 2 API instances + 1 worker"). Same image,
 * same Dockerfile; `WORKER=true` (plan.md §25.3) is the only thing that
 * tells this process to run the worker loop instead of `server.ts`'s
 * HTTP listener.
 */
async function main(): Promise<void> {
  if (!env.WORKER) {
    logger.warn('worker.ts started with WORKER=false — exiting. Set WORKER=true in this container.');
    process.exit(1);
  }

  await connectMongo();
  const reservationStore = new RedisReservationStore(connectRedis());
  const worker = createDomainEventsWorker(createDomainEventJobProcessor(reservationStore));
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'domain-events job failed');
  });
  logger.info('worker started, listening on the domain-events queue');

  const shutdown = async (): Promise<void> => {
    logger.info('worker shutting down');
    await worker.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((err: unknown) => {
  logger.error({ err }, 'failed to boot worker');
  process.exit(1);
});
