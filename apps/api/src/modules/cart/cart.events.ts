import { EventEmitter } from 'node:events';

/**
 * In-process domain events for `cart` — plan.md §5.5's pattern (in-process
 * bus for R1, a BullMQ `domain-events` queue for anything with side
 * effects). Declared now so `engagement`'s abandoned-cart-email flow
 * (plan.md §7.13's `abandonedEmailsSent` field) has a stable event name to
 * subscribe to once that module exists — no subscriber yet, same "declare
 * for future consumers" rationale `identity.events.ts`/`inventory.events
 * .ts` document for their own not-yet-consumed events.
 */
export interface CartEventMap {
  'cart.item_added': { cartId: string; variantId: string; quantity: number };
  'cart.merged': { cartId: string; userId: string };
}

class CartEventBus extends EventEmitter {
  publish<K extends keyof CartEventMap>(event: K, payload: CartEventMap[K]): void {
    this.emit(event, payload);
  }

  subscribe<K extends keyof CartEventMap>(event: K, handler: (payload: CartEventMap[K]) => void): void {
    this.on(event, handler);
  }
}

export const cartEvents = new CartEventBus();
