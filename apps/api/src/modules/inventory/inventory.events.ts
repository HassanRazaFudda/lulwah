import { EventEmitter } from 'node:events';

/**
 * In-process domain events for `inventory` — plan.md §5.3 ("Publishes
 * events: `stock.low`, `stock.out`, `stock.restocked`"). Declared now, per
 * the same "stable name for future subscribers" rationale
 * `identity.events.ts` documents for `user.verified` — nothing subscribes
 * yet (the plan's low-stock digest email and back-in-stock notification
 * flows belong to `engagement`/`notifications`, not built in this phase),
 * but `inventory.service.ts` already fires them on every adjustment so
 * that module has zero catch-up work once it exists.
 */
export interface InventoryEventMap {
  'stock.low': { variantId: string; productId: string; available: number; lowStockThreshold: number };
  'stock.out': { variantId: string; productId: string };
  'stock.restocked': { variantId: string; productId: string; available: number };
}

class InventoryEventBus extends EventEmitter {
  publish<K extends keyof InventoryEventMap>(event: K, payload: InventoryEventMap[K]): void {
    this.emit(event, payload);
  }

  subscribe<K extends keyof InventoryEventMap>(event: K, handler: (payload: InventoryEventMap[K]) => void): void {
    this.on(event, handler);
  }
}

export const inventoryEvents = new InventoryEventBus();
