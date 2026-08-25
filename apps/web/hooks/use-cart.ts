'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';
import {
  addCartItem,
  applyCoupon,
  createCart,
  getCart,
  getCartIdFromCookie,
  removeCartItem,
  removeCoupon,
  updateCartItemQuantity,
} from '@/lib/cart-client';
import type { CartResponse } from '@/lib/cart-schemas';

/**
 * plan.md §12.3: "TanStack Query for cart... optimistic with rollback."
 * One query key (`['cart']`) for the whole cart — every mutation below
 * either optimistically edits that single cached `CartResponse` (quantity
 * change, removal — cases where the client already holds the real line
 * it's editing) or replaces it wholesale with the server's authoritative
 * response (add-item, coupon apply/remove — cases where the server computes
 * something the client can't: merged-line quantities, `availableStock`,
 * discount eligibility). Totals (`subtotalFils`/`discountFils`/.../
 * `grandTotalFils`) are **never** recomputed client-side per plan.md §8.5 —
 * an optimistic update to `items` leaves the previous (stale, real) totals
 * in place until the server's response overwrites the whole object.
 */

const CART_QUERY_KEY = ['cart'] as const;

async function ensureCart(): Promise<CartResponse> {
  const existingId = getCartIdFromCookie();
  if (!existingId) return createCart();
  try {
    return await getCart(existingId);
  } catch (err) {
    // The cookie can outlive the server-side cart (30-day TTL vs. a
    // dev-database reseed, or the cart simply expiring) — plan.md's cart
    // is meant to survive across sessions, not block a customer forever
    // when it can't.
    if (err instanceof ApiError && (err.code === 'CART_NOT_FOUND' || err.code === 'NOT_FOUND')) {
      return createCart();
    }
    throw err;
  }
}

/** Ensures a cart exists (creating one via the cookie-less first visit) and
 *  returns its live, server-computed state. */
export function useCart() {
  return useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: ensureCart,
  });
}

async function requireCartId(queryClient: ReturnType<typeof useQueryClient>): Promise<string> {
  const cached = queryClient.getQueryData<CartResponse>(CART_QUERY_KEY);
  if (cached) return cached.cartId;
  const cookieId = getCartIdFromCookie();
  if (cookieId) return cookieId;
  const created = await createCart();
  queryClient.setQueryData(CART_QUERY_KEY, created);
  return created.cartId;
}

/** `POST /cart/:cartId/items`. Not optimistically inserted — a real cart
 *  line carries server-computed fields (`availableStock`, `priceChanged`,
 *  a merged quantity if this variant is already in the cart) that would
 *  otherwise have to be fabricated — the mutation resolves fast enough
 *  (see `AddToBagForm`'s own `isPending`-driven button state) that
 *  reconciling from the real response on success is the honest tradeoff. */
export function useAddCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { variantId: string; quantity: number }) => {
      const cartId = await requireCartId(queryClient);
      return addCartItem(cartId, input);
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(CART_QUERY_KEY, cart);
    },
  });
}

/** `PATCH /cart/:cartId/items/:itemId` — optimistic: the item being edited
 *  is already in cache with real data, so bumping its quantity locally
 *  isn't fabricating anything the server hasn't already told us. Rolls
 *  back to the pre-mutation snapshot on failure (e.g. `CART_QTY_LIMIT`,
 *  `INSUFFICIENT_STOCK`). */
export function useUpdateCartItemQuantity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const cartId = await requireCartId(queryClient);
      return updateCartItemQuantity(cartId, itemId, quantity);
    },
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY });
      const previous = queryClient.getQueryData<CartResponse>(CART_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<CartResponse>(CART_QUERY_KEY, {
          ...previous,
          items: previous.items.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(CART_QUERY_KEY, context.previous);
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(CART_QUERY_KEY, cart);
    },
  });
}

/** `DELETE /cart/:cartId/items/:itemId` — optimistic removal, same
 *  rollback shape as the quantity mutation above. */
export function useRemoveCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const cartId = await requireCartId(queryClient);
      return removeCartItem(cartId, itemId);
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY });
      const previous = queryClient.getQueryData<CartResponse>(CART_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<CartResponse>(CART_QUERY_KEY, {
          ...previous,
          items: previous.items.filter((item) => item.id !== itemId),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(CART_QUERY_KEY, context.previous);
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(CART_QUERY_KEY, cart);
    },
  });
}

/** `POST /cart/:cartId/coupon` — plan.md §8.3: rejection reasons come
 *  straight from the API's `error.message` (e.g. `COUPON_MIN_SUBTOTAL`,
 *  `COUPON_EXPIRED`, `COUPON_NOT_ELIGIBLE`), rendered as-is by the caller,
 *  never replaced with a generic "Invalid code". Not optimistic — coupon
 *  eligibility is exactly the kind of thing only the server can decide. */
export function useApplyCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const cartId = await requireCartId(queryClient);
      return applyCoupon(cartId, code);
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(CART_QUERY_KEY, cart);
    },
  });
}

export function useRemoveCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const cartId = await requireCartId(queryClient);
      return removeCoupon(cartId);
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(CART_QUERY_KEY, cart);
    },
  });
}

export { CART_QUERY_KEY };
