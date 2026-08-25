import type { Redis } from 'ioredis';
import { AppError } from '../../shared/errors.js';
import { VARIANT_LOCK_MAX_RETRIES, VARIANT_LOCK_RETRY_DELAY_MS, VARIANT_LOCK_TTL_MS } from '../../config/constants.js';

/**
 * Backs plan.md §8.4's reservation flow: a per-variant Redis lock plus a
 * durable record of which cart+variant pairs currently hold a reservation
 * and when each one expires. `RedisReservationStore` is the production
 * implementation; `InMemoryReservationStore` is a `Map`-backed stand-in
 * with identical semantics — same storage-abstraction pattern as
 * `shared/rate-limit.ts`'s `RateLimitStore`, so `cart` integration tests
 * (and the concurrency test that's the point of this whole module) never
 * need a live Redis, exactly like the identity/catalog/inventory suites
 * before them don't.
 *
 * **Why a lock at all, given Mongo already serializes writes per document?**
 * `InventoryItem` is its own document, shared by every cart that reserves
 * against that variant — two concurrent `POST /cart/:id/items` requests for
 * the *same* variant but *different* carts each do a read-then-conditional-
 * write (`available >= quantity?`) against it. Without mutual exclusion,
 * both could read `available: 1` and both then write `reserved += 1`,
 * overselling by one unit. The lock makes that read-check-write atomic in
 * effect. Plan.md §8.4 explicitly allows a plain `SET NX PX` here (no
 * redlock) because this is a single-Redis-instance deployment (§36).
 *
 * **Why a separate expiry index instead of just letting the Redis key
 * expire?** Redis has no built-in way to *enumerate* keys that already
 * expired — by the time you could look, they're gone. So the durable part
 * of "when does this reservation expire" lives in a sorted set
 * (`resv:idx`, member `cartId:variantId`, score = expiry epoch ms) that
 * never itself expires; the sweep job (`jobs/reservation-sweep.job.ts`)
 * polls it every 60s. The actual `resv:{cartId}:{variantId}` TTL key is
 * still written and is what `isReserved` checks — it's the source of truth
 * for "is this reservation still live right now," and its natural Redis-
 * driven expiry is what the sweep job cross-checks against the index to
 * decide whether an entry is a genuine, actionable expiry versus a
 * just-renewed one it should leave alone (see `popExpired`'s doc comment).
 *
 * **Accepted race (single-instance MVP, documented rather than solved):**
 * if a cart mutation calls `clearReserved` for a cart+variant in the exact
 * window between the sweep job reading that pair out of the index and its
 * own `EXISTS` check, the sweep could still report it as expired, and the
 * caller (`cart.service.ts`) would attempt to release stock that's already
 * been released. `inventory.repository.ts#applyReleaseAndRecordMovement`
 * clamps `reserved` at 0, so the worst outcome is a harmless no-op double
 * release, never an oversell. Closing this fully would need a Lua script
 * making "check index score, check TTL key, remove both" atomic — more
 * machinery than a single-instance deployment's reservation bookkeeping
 * warrants (plan.md §8.4 itself waives redlock for the same reason).
 */
export interface ReservationStore {
  /** Runs `fn` while holding an exclusive lock on `variantId`. Retries
   *  briefly if another request holds it; throws `SERVICE_UNAVAILABLE` if
   *  it can't acquire the lock in time. Always releases, even if `fn`
   *  throws. */
  withVariantLock<T>(variantId: string, fn: () => Promise<T>): Promise<T>;
  /** Sets or renews the reservation marker for `cartId`+`variantId`,
   *  expiring in `ttlMs`, and schedules its expiry in the durable index. */
  markReserved(cartId: string, variantId: string, ttlMs: number): Promise<void>;
  /** Whether a currently-active (non-expired) reservation exists. */
  isReserved(cartId: string, variantId: string): Promise<boolean>;
  /** Clears the reservation marker and its scheduled-expiry index entry —
   *  the explicit-release path (item removed, quantity reduced to 0, cart
   *  merged away). */
  clearReserved(cartId: string, variantId: string): Promise<void>;
  /** Pops up to `limit` cart+variant pairs whose reservation has genuinely
   *  expired (the TTL key is confirmed gone, not just past its originally-
   *  scheduled expiry — see this interface's doc comment), removing them
   *  from the index as it returns them. */
  popExpired(limit: number): Promise<Array<{ cartId: string; variantId: string }>>;
}

function lockErrorFor(variantId: string): AppError {
  return new AppError('SERVICE_UNAVAILABLE', 503, {
    messageEn: 'This item is being updated by another request. Please try again in a moment.',
    details: { variantId },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const INDEX_KEY = 'resv:idx';
const reservationKey = (cartId: string, variantId: string): string => `resv:${cartId}:${variantId}`;
const indexMember = (cartId: string, variantId: string): string => `${cartId}:${variantId}`;
const lockKey = (variantId: string): string => `lock:variant:${variantId}`;

/** CAS release: only delete the lock if it still holds the token we set —
 *  guards against releasing a lock some other holder acquired after ours
 *  expired under us (a slow `fn`). */
const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export class RedisReservationStore implements ReservationStore {
  constructor(private readonly redis: Redis) {}

  async withVariantLock<T>(variantId: string, fn: () => Promise<T>): Promise<T> {
    const key = lockKey(variantId);
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    let acquired = false;
    for (let attempt = 0; attempt < VARIANT_LOCK_MAX_RETRIES; attempt += 1) {
      const result = await this.redis.set(key, token, 'PX', VARIANT_LOCK_TTL_MS, 'NX');
      if (result === 'OK') {
        acquired = true;
        break;
      }
      await sleep(VARIANT_LOCK_RETRY_DELAY_MS);
    }
    if (!acquired) throw lockErrorFor(variantId);

    try {
      return await fn();
    } finally {
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token).catch(() => undefined);
    }
  }

  async markReserved(cartId: string, variantId: string, ttlMs: number): Promise<void> {
    const expiresAt = Date.now() + ttlMs;
    const pipeline = this.redis.multi();
    pipeline.set(reservationKey(cartId, variantId), '1', 'PX', ttlMs);
    pipeline.zadd(INDEX_KEY, expiresAt, indexMember(cartId, variantId));
    await pipeline.exec();
  }

  async isReserved(cartId: string, variantId: string): Promise<boolean> {
    const exists = await this.redis.exists(reservationKey(cartId, variantId));
    return exists === 1;
  }

  async clearReserved(cartId: string, variantId: string): Promise<void> {
    const pipeline = this.redis.multi();
    pipeline.del(reservationKey(cartId, variantId));
    pipeline.zrem(INDEX_KEY, indexMember(cartId, variantId));
    await pipeline.exec();
  }

  async popExpired(limit: number): Promise<Array<{ cartId: string; variantId: string }>> {
    const now = Date.now();
    const members = await this.redis.zrangebyscore(INDEX_KEY, '-inf', now, 'LIMIT', 0, limit);
    const expired: Array<{ cartId: string; variantId: string }> = [];
    for (const member of members) {
      const separator = member.indexOf(':');
      if (separator <= 0) {
        await this.redis.zrem(INDEX_KEY, member);
        continue;
      }
      const cartId = member.slice(0, separator);
      const variantId = member.slice(separator + 1);
      const stillActive = await this.redis.exists(reservationKey(cartId, variantId));
      if (stillActive) continue; // renewed since the index entry was scheduled — leave it, its score was already bumped forward (or will be)
      await this.redis.zrem(INDEX_KEY, member);
      expired.push({ cartId, variantId });
    }
    return expired;
  }
}

interface InMemoryReservation {
  expiresAt: number;
}

/** `Map`-backed reservation store with identical semantics — no Redis
 *  required. Used by cart integration/concurrency tests. The lock is a
 *  real per-key async mutex (a chained-promise queue), not a no-op, so
 *  tests that fire concurrent `Promise.all([...])` mutations against the
 *  same variant genuinely exercise the same serialization the Redis
 *  implementation provides — proving `cart.service.ts`'s reservation logic
 *  itself is correct, independent of which store backs it. */
export class InMemoryReservationStore implements ReservationStore {
  private readonly reservations = new Map<string, InMemoryReservation>();
  private readonly mutexes = new Map<string, Promise<unknown>>();

  async withVariantLock<T>(variantId: string, fn: () => Promise<T>): Promise<T> {
    const key = lockKey(variantId);
    const prior = this.mutexes.get(key) ?? Promise.resolve();
    const run = prior.then(fn, fn);
    this.mutexes.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  markReserved(cartId: string, variantId: string, ttlMs: number): Promise<void> {
    this.reservations.set(indexMember(cartId, variantId), { expiresAt: Date.now() + ttlMs });
    return Promise.resolve();
  }

  isReserved(cartId: string, variantId: string): Promise<boolean> {
    const entry = this.reservations.get(indexMember(cartId, variantId));
    return Promise.resolve(entry !== undefined && entry.expiresAt > Date.now());
  }

  clearReserved(cartId: string, variantId: string): Promise<void> {
    this.reservations.delete(indexMember(cartId, variantId));
    return Promise.resolve();
  }

  popExpired(limit: number): Promise<Array<{ cartId: string; variantId: string }>> {
    const now = Date.now();
    const expired: Array<{ cartId: string; variantId: string }> = [];
    for (const [member, entry] of this.reservations.entries()) {
      if (expired.length >= limit) break;
      if (entry.expiresAt > now) continue;
      const separator = member.indexOf(':');
      if (separator <= 0) continue;
      expired.push({ cartId: member.slice(0, separator), variantId: member.slice(separator + 1) });
    }
    for (const { cartId, variantId } of expired) this.reservations.delete(indexMember(cartId, variantId));
    return Promise.resolve(expired);
  }
}
