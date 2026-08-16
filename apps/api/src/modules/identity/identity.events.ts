import { EventEmitter } from 'node:events';
import type { User } from '@lulwah/contracts';

/**
 * In-process domain events for `identity` — plan.md §5.3 ("Publishes
 * events: `user.registered`, `user.verified`") and §5.5 ("In-process
 * EventEmitter for R1, published to a BullMQ `domain-events` queue for
 * anything with side effects"). Only `user.registered` actually fires in
 * this skeleton (from `identity.service.ts#register`); `user.verified`
 * is declared now so email-verification, once built, has a stable event
 * name subscribers can already depend on.
 *
 * A module reaching into another module's business logic without going
 * through its service interface or an event like this one is exactly
 * what plan.md §5.3's module-boundary ESLint rule exists to catch.
 */
export interface IdentityEventMap {
  'user.registered': { user: User };
  'user.verified': { user: User };
}

class IdentityEventBus extends EventEmitter {
  publish<K extends keyof IdentityEventMap>(event: K, payload: IdentityEventMap[K]): void {
    this.emit(event, payload);
  }

  subscribe<K extends keyof IdentityEventMap>(event: K, handler: (payload: IdentityEventMap[K]) => void): void {
    this.on(event, handler);
  }
}

export const identityEvents = new IdentityEventBus();
