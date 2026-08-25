import type { Queue } from 'bullmq';
import { sweepExpiredReservations } from '../modules/cart/cart.service.js';
import type { ReservationStore } from '../modules/cart/reservation-store.js';
import { logger } from '../shared/logger.js';

/**
 * plan.md §8.4: "Expiry is handled by a BullMQ repeatable job every 60s
 * that releases stale reservations and writes a `release` movement." Same
 * "register once at boot, from `server.ts`" shape as `jobs/meilisearch-
 * sync.job.ts`, except this job doesn't bridge an in-process event —
 * it's scheduled directly as a BullMQ *repeatable* job (`repeat: { every:
 * 60_000 }`), since there's no per-event trigger for "time has passed."
 */
export const RESERVATION_SWEEP_JOB_NAME = 'cart.sweep-reservations';
const SWEEP_INTERVAL_MS = 60_000;

/** Registers the repeatable schedule via BullMQ v6's job-scheduler API
 *  (the old `{ repeat: {...} }` job option from v5 is deprecated —
 *  `upsertJobScheduler` is its replacement). `upsert` makes this
 *  idempotent across repeated boots/deploys — calling it again with the
 *  same scheduler id updates the existing schedule instead of stacking up
 *  a duplicate one every time the API process restarts. */
export async function registerReservationSweepOnQueue(queue: Queue): Promise<void> {
  await queue.upsertJobScheduler(RESERVATION_SWEEP_JOB_NAME, { every: SWEEP_INTERVAL_MS }, { name: RESERVATION_SWEEP_JOB_NAME, data: {} });
}

/** `worker.ts`'s dispatch table entry for this job name. */
export async function processReservationSweepJob(reservationStore: ReservationStore): Promise<void> {
  const released = await sweepExpiredReservations(reservationStore);
  if (released > 0) logger.info({ released }, 'reservation-sweep: released stale cart reservations');
}
