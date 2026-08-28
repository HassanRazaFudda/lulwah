import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  tone: 'success' | 'error';
  text: string;
}

interface ToastState {
  toasts: ToastMessage[];
  push: (tone: ToastMessage['tone'], text: string) => void;
  dismiss: (id: string) => void;
}

/**
 * plan.md §11.2 rule 2: "rollback + toast on failure." No toast primitive
 * existed anywhere in `apps/admin` before this task (`orders.ts`'s
 * optimistic mutations roll back but surface errors as inline
 * `mutation.error` text, not a toast — see call sites in
 * `orders/[id]/page.tsx`) — this is the first one, built for the Content
 * screen's mutations and reusable by any future screen. Zustand, matching
 * `lib/stores/ui-store.ts`'s existing precedent for small client-only UI
 * state, not TanStack Query state.
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (tone, text) =>
    set((state) => ({ toasts: [...state.toasts, { id: crypto.randomUUID(), tone, text }] })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience for call sites outside a component (mutation `onError`
 *  callbacks) — `useToastStore.getState()` is the documented Zustand
 *  pattern for reading/acting on a store outside React's render cycle. */
export function pushToast(tone: ToastMessage['tone'], text: string): void {
  useToastStore.getState().push(tone, text);
}
