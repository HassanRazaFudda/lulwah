import { EventEmitter } from 'node:events';

/**
 * In-process domain events for `engagement` — plan.md §5.3: "Publishes
 * events: `review.submitted`". Declared now, same "stable name for future
 * subscribers" rationale `content.events.ts`/`inventory.events.ts` document
 * — nothing subscribes yet (a moderation-queue notification to staff, or a
 * "thanks for your review" email to the shopper, both belong to a
 * notifications workstream out of scope for this pass per the brief), but
 * `review.service.ts` already fires this on every submission so that
 * workstream has zero catch-up work once it exists.
 */
export interface EngagementEventMap {
  'review.submitted': { reviewId: string; productId: string; userId: string };
}

class EngagementEventBus extends EventEmitter {
  publish<K extends keyof EngagementEventMap>(event: K, payload: EngagementEventMap[K]): void {
    this.emit(event, payload);
  }

  subscribe<K extends keyof EngagementEventMap>(event: K, handler: (payload: EngagementEventMap[K]) => void): void {
    this.on(event, handler);
  }
}

export const engagementEvents = new EngagementEventBus();
