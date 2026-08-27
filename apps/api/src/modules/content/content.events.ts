import { EventEmitter } from 'node:events';

/**
 * In-process domain events for `content` — plan.md §12.2: "Home: ISR 300s +
 * on-demand on content publish", "Content pages: SSG + on-demand
 * revalidate". Declared now, same "stable name for future subscribers"
 * rationale `inventory.events.ts` documents — nothing subscribes yet (a
 * storefront on-demand-revalidation webhook belongs to `apps/web`, out of
 * scope for this pass per the brief), but every write path already fires
 * these so that workstream has zero catch-up work once it exists.
 */
export interface ContentEventMap {
  'home.updated': Record<string, never>;
  'page.published': { slug: string };
  'menu.updated': { location: string };
  'banner.updated': { bannerId: string };
}

class ContentEventBus extends EventEmitter {
  publish<K extends keyof ContentEventMap>(event: K, payload: ContentEventMap[K]): void {
    this.emit(event, payload);
  }

  subscribe<K extends keyof ContentEventMap>(event: K, handler: (payload: ContentEventMap[K]) => void): void {
    this.on(event, handler);
  }
}

export const contentEvents = new ContentEventBus();
