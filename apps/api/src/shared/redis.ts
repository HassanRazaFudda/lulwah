import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * One ioredis client for the process — used by the sliding-window rate
 * limiter (`rate-limit.ts`) today, and will back cart/session caching and
 * the BullMQ `domain-events` queue connection as those modules land.
 * Stateless API rule (plan.md §5.6): nothing here is ever read without a
 * TTL or written without an owner key prefix.
 */
export function connect(url: string = env.REDIS_URL): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    // Reconnect on its own; never block boot waiting for Redis to appear.
    lazyConnect: false,
  });
  client.on('error', (err: Error) => logger.error({ err }, 'redis connection error'));
  client.on('connect', () => logger.info('redis connected'));
  return client;
}
