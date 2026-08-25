/**
 * Domain events for `order` — plan.md §8.7.3: "implement via domain events
 * (the pattern from `cart.events.ts`/`catalog.events.ts`), not inline in
 * the status-update code path."
 *
 * **Deliberate adaptation of that pattern, not a copy of it.** `cart
 * .events.ts`/`catalog.events.ts` are plain `node:events` `EventEmitter`
 * wrappers — fire-and-forget, because every real subscriber they have
 * today is an async BullMQ bridge (`jobs/meilisearch-sync.job.ts`,
 * `jobs/reservation-sweep.job.ts`) that's fine running after the
 * triggering request has already responded. Order confirmation's side
 * effects are not that: "reservation → sale movement, `onHand -= qty`"
 * (plan.md §8.4) is a correctness-critical write that must complete
 * *before* `PATCH /admin/orders/:id/status` responds 200 — a client (or
 * this build's own integration tests) checking stock immediately after
 * must see it already decremented, not eventually-consistent a few
 * seconds later on a worker. A plain `EventEmitter.emit()` doesn't await
 * its listeners' returned promises, so it can't provide that.
 *
 * This bus keeps the *structural* separation the brief asks for — named
 * handler functions registered elsewhere (`order.service.ts`'s own
 * `orderEvents.subscribe(...)` calls, right where the transition function
 * that publishes them lives, so the "don't inline it" boundary is about
 * function decomposition, not about which file the code lives in) — while
 * making `publish` genuinely awaitable, so `updateOrderStatus` can
 * `await orderEvents.publish(...)` and have the request only resolve once
 * every side effect has actually run.
 */
export interface OrderEventMap {
  /** Fires for every status change, valid or forced — the generic hook the
   *  customer-notification stub listens on, gated by `notifyCustomer`. */
  'order.status_changed': { orderId: string; orderNumber: string; from: string | null; to: string; notifyCustomer: boolean };
  /** on → `confirmed` (plan.md §8.7.3): reservation → sale, invoice number,
   *  discount usage +1, product `soldCount` +1. */
  'order.confirmed': { orderId: string };
  /** on → `cancelled`: release reservation/stock, discount usage -1. */
  'order.cancelled': { orderId: string };
  /** on → `delivered`: `deliveredAt` set, COD payment considered collected. */
  'order.delivered': { orderId: string };
}

type Handler<T> = (payload: T) => Promise<void> | void;

class OrderEventBus {
  private readonly handlers = new Map<keyof OrderEventMap, Handler<OrderEventMap[keyof OrderEventMap]>[]>();

  subscribe<K extends keyof OrderEventMap>(event: K, handler: Handler<OrderEventMap[K]>): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as Handler<OrderEventMap[keyof OrderEventMap]>);
    this.handlers.set(event, list);
  }

  /** Runs every handler registered for `event`, in registration order,
   *  awaiting each — a handler's rejection propagates to the caller (the
   *  transition function), which is exactly what "don't return 200 until
   *  the side effect actually happened" requires. */
  async publish<K extends keyof OrderEventMap>(event: K, payload: OrderEventMap[K]): Promise<void> {
    const list = this.handlers.get(event) ?? [];
    for (const handler of list) {
      await handler(payload);
    }
  }
}

export const orderEvents = new OrderEventBus();
