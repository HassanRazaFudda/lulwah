import type { Redis } from 'ioredis';
import { IDEMPOTENCY_KEY_TTL_MS, IDEMPOTENCY_LOCK_TTL_MS } from '../../config/constants.js';

/**
 * Backs `POST /checkout/session/:id/place`'s `Idempotency-Key` requirement
 * (plan.md §9.5) — "a short-TTL Redis record of 'this key already produced
 * order X'." Same storage-abstraction pattern as `shared/rate-limit.ts`'s
 * `RateLimitStore`/`cart/reservation-store.ts`'s `ReservationStore`:
 * `RedisIdempotencyStore` for production, `InMemoryIdempotencyStore` for
 * integration tests, identical semantics either way.
 *
 * A single key per idempotency key holds either the sentinel `'PENDING'`
 * (a request for this key is currently being processed — claimed but not
 * yet completed) or the real order id (a previous request already
 * finished). This is the fast-path, best-effort half of the guarantee;
 * `order.model.ts`'s unique index on `idempotencyKey` is the correctness
 * backstop for the case this store loses data (a Redis restart) or two
 * `claim()` calls race in the tiny window `SET NX` doesn't cover across a
 * cluster — see `checkout.service.ts#place`'s doc comment.
 */
export type IdempotencyClaim = { state: 'new' } | { state: 'in_progress' } | { state: 'done'; orderId: string };

export interface IdempotencyStore {
  /** Attempts to become the request that processes `key`. `'new'` means
   *  the caller should proceed; `'in_progress'` means another request for
   *  the same key is still running; `'done'` means one already finished —
   *  its `orderId` should be returned as-is, nothing re-created. */
  claim(key: string): Promise<IdempotencyClaim>;
  /** Records the real outcome, overwriting the `'PENDING'` placeholder
   *  with a long-TTL record of the order it produced. */
  complete(key: string, orderId: string): Promise<void>;
  /** Releases a `'PENDING'` placeholder after a failed attempt, so a
   *  legitimate client retry isn't wedged behind `IDEMPOTENCY_LOCK_TTL_MS`. */
  release(key: string): Promise<void>;
}

const PENDING = 'PENDING';
const key = (k: string): string => `idempotency:place:${k}`;

export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(private readonly redis: Redis) {}

  async claim(k: string): Promise<IdempotencyClaim> {
    const set = await this.redis.set(key(k), PENDING, 'PX', IDEMPOTENCY_LOCK_TTL_MS, 'NX');
    if (set === 'OK') return { state: 'new' };
    const value = await this.redis.get(key(k));
    if (value === null || value === PENDING) return { state: 'in_progress' };
    return { state: 'done', orderId: value };
  }

  async complete(k: string, orderId: string): Promise<void> {
    await this.redis.set(key(k), orderId, 'PX', IDEMPOTENCY_KEY_TTL_MS);
  }

  async release(k: string): Promise<void> {
    await this.redis.del(key(k));
  }
}

interface InMemoryEntry {
  value: string;
  expiresAt: number;
}

/** `Map`-backed store with identical semantics — no Redis required. */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, InMemoryEntry>();

  claim(k: string): Promise<IdempotencyClaim> {
    const existing = this.entries.get(k);
    if (existing && existing.expiresAt > Date.now()) {
      return Promise.resolve(existing.value === PENDING ? { state: 'in_progress' } : { state: 'done', orderId: existing.value });
    }
    this.entries.set(k, { value: PENDING, expiresAt: Date.now() + IDEMPOTENCY_LOCK_TTL_MS });
    return Promise.resolve({ state: 'new' });
  }

  complete(k: string, orderId: string): Promise<void> {
    this.entries.set(k, { value: orderId, expiresAt: Date.now() + IDEMPOTENCY_KEY_TTL_MS });
    return Promise.resolve();
  }

  release(k: string): Promise<void> {
    this.entries.delete(k);
    return Promise.resolve();
  }
}
