import type { NextFunction, Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { AppError } from './errors.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Storage abstraction so the limiter itself never touches Redis directly —
 * `RedisRateLimitStore` in production, `InMemoryRateLimitStore` for tests
 * and Redis-less local dev (plan.md scope note: integration tests must
 * not require a running Redis).
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number, max: number): Promise<RateLimitResult>;
}

function countFromPipeline(results: Array<[Error | null, unknown]> | null, index: number): number {
  const entry = results?.[index];
  const value = entry?.[1];
  return typeof value === 'number' ? value : 0;
}

/**
 * Redis sorted-set sliding window (plan.md §9.8): each hit records `now`
 * as a sorted-set member, prunes anything older than the window, then
 * counts what's left. Unlike a fixed-window counter, this can't let 2x
 * the limit through at a window boundary.
 */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: Redis) {}

  async hit(key: string, windowMs: number, max: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    const pipeline = this.redis.multi();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now, member);
    pipeline.zcard(key);
    pipeline.pexpire(key, windowMs);
    const results = await pipeline.exec();
    const count = countFromPipeline(results, 2);
    return { allowed: count <= max, remaining: Math.max(0, max - count) };
  }
}

/** `Map`-backed sliding window with identical semantics — no Redis
 *  required. Used by integration tests and available for local dev. */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly hits = new Map<string, number[]>();

  hit(key: string, windowMs: number, max: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > windowStart);
    timestamps.push(now);
    this.hits.set(key, timestamps);
    const count = timestamps.length;
    return Promise.resolve({ allowed: count <= max, remaining: Math.max(0, max - count) });
  }
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
  /** Defaults to per-IP (plan.md §9.8's "10/min/IP"); pass a custom
   *  generator for per-user buckets on authenticated routes. */
  keyGenerator?: (req: Request) => string;
}

/** Express middleware factory. Apply per router/route — e.g. the whole
 *  `/api/v1/auth` router gets the 10/min/IP bucket (`identity.routes.ts`). */
export function createRateLimiter(store: RateLimitStore, options: RateLimiterOptions) {
  const keyGenerator = options.keyGenerator ?? ((req: Request) => req.ip ?? 'unknown');
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const key = `ratelimit:${options.keyPrefix}:${keyGenerator(req)}`;
    const result = await store.hit(key, options.windowMs, options.max);
    if (!result.allowed) {
      next(new AppError('RATE_LIMITED', 429, { messageEn: 'Too many requests. Please try again shortly.' }));
      return;
    }
    next();
  };
}
