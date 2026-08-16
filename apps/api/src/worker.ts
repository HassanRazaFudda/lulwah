import { env } from './shared/env.js';
import { logger } from './shared/logger.js';
import { connect as connectMongo } from './shared/mongo.js';
import { createDomainEventsWorker } from './jobs/domain-events.queue.js';

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
  const worker = createDomainEventsWorker();
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
