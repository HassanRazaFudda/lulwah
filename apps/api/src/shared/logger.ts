import pino from 'pino';
import { env } from './env.js';

/**
 * Single pino instance for the whole process. `req.log` (attached by
 * `request-id.ts`) is a *child* of this logger with `requestId` bound, so
 * every log line for a request — and any Sentry event, per plan.md §9.8 —
 * carries the same correlator without every call site passing it by hand.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: '@lulwah/api' },
  timestamp: pino.stdTimeFunctions.isoTime,
});
