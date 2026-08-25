import { describe, expect, it } from 'vitest';
import { InMemoryReservationStore } from '../reservation-store.js';

/**
 * Unit coverage for `ReservationStore`'s locking/expiry-index primitives in
 * isolation from Mongo/inventory — `cart.integration.test.ts` covers the
 * same reservation flow end-to-end through real HTTP + `InventoryItem`
 * writes; this file proves the store's own mutual-exclusion and expiry
 * bookkeeping are correct on their own.
 */

describe('InMemoryReservationStore.withVariantLock', () => {
  it('serializes concurrent callers for the same key — no interleaving', async () => {
    const store = new InMemoryReservationStore();
    const order: string[] = [];

    async function critical(label: string, delayMs: number): Promise<void> {
      await store.withVariantLock('variant-A', async () => {
        order.push(`${label}-start`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        order.push(`${label}-end`);
      });
    }

    // Fire three concurrent "requests" against the same variant — a naive
    // unlocked implementation would interleave; a real mutex processes
    // them one at a time, start immediately followed by its own end.
    await Promise.all([critical('a', 20), critical('b', 5), critical('c', 10)]);

    // Whichever order they were serialized in, each entry's "-start" must
    // be immediately followed by that same entry's "-end" — never another
    // request's start slipping in between.
    for (let i = 0; i < order.length; i += 2) {
      const startLabel = order[i]?.split('-')[0];
      const endLabel = order[i + 1]?.split('-')[0];
      expect(endLabel).toBe(startLabel);
    }
    expect(order).toHaveLength(6);
  });

  it('does not block concurrent locks on different keys', async () => {
    const store = new InMemoryReservationStore();
    const start = Date.now();
    await Promise.all([
      store.withVariantLock('variant-A', () => new Promise((resolve) => setTimeout(resolve, 30))),
      store.withVariantLock('variant-B', () => new Promise((resolve) => setTimeout(resolve, 30))),
    ]);
    // If they were serialized (wrongly sharing a lock), this would take
    // ~60ms; run concurrently it should take ~30ms. Generous bound for CI jitter.
    expect(Date.now() - start).toBeLessThan(55);
  });

  it('releases the lock even when `fn` throws, so the next caller isn’t stuck forever', async () => {
    const store = new InMemoryReservationStore();
    await expect(
      store.withVariantLock('variant-A', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // A second acquisition on the same key must still succeed promptly.
    let ran = false;
    await store.withVariantLock('variant-A', async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });
});

describe('InMemoryReservationStore reservation bookkeeping', () => {
  it('markReserved makes isReserved true until it expires', async () => {
    const store = new InMemoryReservationStore();
    expect(await store.isReserved('cart-1', 'variant-1')).toBe(false);
    await store.markReserved('cart-1', 'variant-1', 1000);
    expect(await store.isReserved('cart-1', 'variant-1')).toBe(true);
  });

  it('clearReserved removes it immediately', async () => {
    const store = new InMemoryReservationStore();
    await store.markReserved('cart-1', 'variant-1', 10_000);
    await store.clearReserved('cart-1', 'variant-1');
    expect(await store.isReserved('cart-1', 'variant-1')).toBe(false);
  });

  it('popExpired only returns entries whose TTL has actually lapsed, and removes them from the index', async () => {
    const store = new InMemoryReservationStore();
    await store.markReserved('cart-1', 'variant-1', -1); // already expired
    await store.markReserved('cart-2', 'variant-2', 60_000); // far in the future

    const expired = await store.popExpired(10);
    expect(expired).toEqual([{ cartId: 'cart-1', variantId: 'variant-1' }]);

    // Popped once — a second call must not return it again.
    const secondPop = await store.popExpired(10);
    expect(secondPop).toHaveLength(0);

    // The still-active one is untouched.
    expect(await store.isReserved('cart-2', 'variant-2')).toBe(true);
  });

  it('respects the limit parameter', async () => {
    const store = new InMemoryReservationStore();
    for (let i = 0; i < 5; i += 1) {
      await store.markReserved(`cart-${i}`, `variant-${i}`, -1);
    }
    const expired = await store.popExpired(2);
    expect(expired).toHaveLength(2);
  });
});
