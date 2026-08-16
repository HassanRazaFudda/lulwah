import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Local cart state — plan.md's Out of scope note: "cart/checkout can use
 * local component state / placeholder data" (no `apps/api` cart module
 * wired up in this workstream). This is deliberately shaped like a real
 * cart line so swapping it for TanStack Query + the real `/cart` endpoint
 * later (§12.3: "TanStack Query for cart... optimistic with rollback") is
 * a like-for-like replacement — `unitPriceFils`/`compareAtPriceFils` are
 * snapshotted at add-time exactly as `@lulwah/contracts`' `CartItem`
 * schema (§7.10) does.
 */
export interface CartLineItem {
  id: string;
  productSlug: string;
  brandName: string;
  title: string;
  image: { src: string; alt: string };
  stitchingType: string;
  pieceCount: 1 | 2 | 3 | null;
  colorName?: string;
  size?: string;
  quantity: number;
  unitPriceFils: number;
  compareAtPriceFils: number | null;
}

interface CartState {
  items: CartLineItem[];
  addItem: (item: Omit<CartLineItem, 'quantity'> & { quantity?: number }) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const quantity = item.quantity ?? 1;
          const existingIndex = state.items.findIndex((line) => line.id === item.id);
          if (existingIndex === -1) {
            return { items: [...state.items, { ...item, quantity }] };
          }
          const items = [...state.items];
          const existing = items[existingIndex];
          if (!existing) return { items };
          // Cart item limit — plan.md §8.5's per-line max quantity of 10.
          items[existingIndex] = { ...existing, quantity: Math.min(existing.quantity + quantity, 10) };
          return { items };
        }),
      updateQuantity: (id, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((line) => line.id !== id)
              : state.items.map((line) => (line.id === id ? { ...line, quantity: Math.min(quantity, 10) } : line)),
        })),
      removeItem: (id) => set((state) => ({ items: state.items.filter((line) => line.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'lulwah-cart' },
  ),
);
