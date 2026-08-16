import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Guest wishlist — plan.md §12.3 Zustand slices ("filters, search, locale,
 * motionPrefs" are named explicitly; wishlist follows the same pattern:
 * small client-only UI state, persisted so it survives a refresh before
 * there is an account to sync it to). Real account sync (§3.2 feature 45,
 * "Wishlist (guest + synced)") is API work outside this skeleton — this
 * store is deliberately just `Set<slug>` plus a toggle, no fetching.
 */
interface WishlistState {
  slugs: Set<string>;
  isWishlisted: (slug: string) => boolean;
  toggle: (slug: string) => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      slugs: new Set<string>(),
      isWishlisted: (slug) => get().slugs.has(slug),
      toggle: (slug) =>
        set((state) => {
          const next = new Set(state.slugs);
          if (next.has(slug)) {
            next.delete(slug);
          } else {
            next.add(slug);
          }
          return { slugs: next };
        }),
    }),
    {
      name: 'lulwah-wishlist',
      // `Set` isn't JSON-serialisable by default; a replacer/reviver pair
      // round-trips it through a plain array. `isWishlisted`/`toggle` don't
      // need any special handling — `JSON.stringify` drops function-valued
      // properties on its own, and persist merges the restored `slugs`
      // back onto the live store (which still has its methods) on rehydrate.
      storage: createJSONStorage(() => localStorage, {
        replacer: (_key, value) => (value instanceof Set ? { __type: 'Set', values: [...value] } : value),
        reviver: (_key, value) => {
          if (value && typeof value === 'object' && (value as { __type?: string }).__type === 'Set') {
            return new Set((value as { values: string[] }).values);
          }
          return value;
        },
      }),
    },
  ),
);
