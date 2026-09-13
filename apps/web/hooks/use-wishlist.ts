'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Wishlist } from '@lulwah/contracts';
import { addWishlistItem, getWishlist, removeWishlistItem } from '@/lib/wishlist-client';

/**
 * plan.md §12.3 "TanStack Query... optimistic with rollback" applied to the
 * wishlist exactly the way `hooks/use-cart.ts` applies it to cart — one
 * query key for the whole wishlist, mutations optimistically edit the
 * cached `Wishlist.items` (a toggle already knows which product it's
 * adding/removing, same as cart's quantity/removal edits) and roll back on
 * failure, then reconcile from the server's authoritative response on
 * success.
 *
 * Replaces `stores/wishlist-store.ts` (deleted) — that was a client-only
 * `Set<slug>` in localStorage, explicitly documented there as a stand-in
 * until "real account sync is API work outside this skeleton." That API
 * (`engagement` module) now exists; this is the real client for it.
 */

const WISHLIST_QUERY_KEY = ['wishlist'] as const;

export function useWishlist() {
  return useQuery({
    queryKey: WISHLIST_QUERY_KEY,
    queryFn: getWishlist,
  });
}

function itemIndex(wishlist: Wishlist | undefined, productId: string): boolean {
  return (wishlist?.items ?? []).some((item) => item.productId === productId);
}

/** Reads the shared wishlist query and reports whether one product is on
 *  it — `WishlistButton`'s only read need. Multiple call sites (every
 *  `ProductCard` on a grid) share the exact same `queryKey`, so this is one
 *  network request for the whole page, not one per card. */
export function useIsWishlisted(productId: string): boolean {
  const { data } = useWishlist();
  return itemIndex(data, productId);
}

/** `POST /me/wishlist`. Optimistic: a card's heart fills immediately, the
 *  real `priceAtAddFils`/`addedAt` the server computes reconciles in on
 *  success, and a failure (e.g. a dropped connection) rolls the heart back
 *  to empty rather than leaving a lie on screen. */
export function useAddWishlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; variantId?: string | null }) => addWishlistItem(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_QUERY_KEY });
      const previous = queryClient.getQueryData<Wishlist>(WISHLIST_QUERY_KEY);
      if (previous && !itemIndex(previous, input.productId)) {
        queryClient.setQueryData<Wishlist>(WISHLIST_QUERY_KEY, {
          ...previous,
          items: [
            ...previous.items,
            { productId: input.productId, variantId: input.variantId ?? null, addedAt: new Date(), priceAtAddFils: 0 },
          ],
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(WISHLIST_QUERY_KEY, context.previous);
    },
    onSuccess: (wishlist) => {
      queryClient.setQueryData(WISHLIST_QUERY_KEY, wishlist);
    },
  });
}

/** `DELETE /me/wishlist/:productId` — same optimistic/rollback shape. */
export function useRemoveWishlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => removeWishlistItem(productId),
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_QUERY_KEY });
      const previous = queryClient.getQueryData<Wishlist>(WISHLIST_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<Wishlist>(WISHLIST_QUERY_KEY, {
          ...previous,
          items: previous.items.filter((item) => item.productId !== productId),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(WISHLIST_QUERY_KEY, context.previous);
    },
    onSuccess: (wishlist) => {
      queryClient.setQueryData(WISHLIST_QUERY_KEY, wishlist);
    },
  });
}

/**
 * ---------------------------------------------------------------------
 * `POST /me/wishlist/merge` is NOT called from anywhere in this app.
 * ---------------------------------------------------------------------
 * plan.md's wishlist spec calls for folding a guest wishlist into the
 * user's own "on login". This storefront has no login/register page
 * anywhere (confirmed by grepping all of `apps/web` before this workstream
 * — `account/orders/page.tsx` documents the same gap for order history),
 * so there is no login-success handler in this codebase to call it from
 * yet.
 *
 * `lib/wishlist-client.ts#mergeWishlistOnLogin()` is written, exported, and
 * ready — the future login success handler (wherever it ends up living,
 * e.g. a new `hooks/use-auth.ts#useLogin()`'s `onSuccess`) should call it
 * exactly once, right after a real login response is handled, the same way
 * `cart`'s own merge-on-login call is triggered elsewhere in real
 * deployments of this pattern. Left here as an explicit marker so it isn't
 * silently forgotten when that login flow is finally built.
 */
export function useToggleWishlist(productId: string, variantId?: string | null) {
  const isWishlisted = useIsWishlisted(productId);
  const add = useAddWishlistItem();
  const remove = useRemoveWishlistItem();

  function toggle() {
    if (isWishlisted) {
      remove.mutate(productId);
    } else {
      add.mutate({ productId, variantId: variantId ?? null });
    }
  }

  return { isWishlisted, toggle, isPending: add.isPending || remove.isPending };
}
