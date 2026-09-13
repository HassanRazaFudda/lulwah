import type { Wishlist } from '@lulwah/contracts';
import { apiFetch } from './api-client';
import { WishlistResponse } from './wishlist-schemas';

/**
 * Thin fetch functions over `apiFetch` for the real `engagement` wishlist
 * endpoints (`apps/api/src/modules/engagement/wishlist.routes.ts`) — the
 * same "thin fetch layer, all cookie/identity handling delegated to
 * `apiFetch`'s `credentials: 'include'`" shape `cart-client.ts` already
 * establishes for `cart`'s own guest cookie.
 *
 * No client-side cookie reading is needed here (unlike `cart-client.ts`'s
 * `getCartIdFromCookie`): `cart` needs the cookie's *value* client-side
 * because the cart id is a URL path segment (`/cart/:cartId/...`); the
 * wishlist's guest identity (`lulwah_wishlist_guest`, set by
 * `wishlist.controller.ts#resolveIdentity`) is never read by the client at
 * all — every wishlist route is a bare `/me/wishlist*` path, and the cookie
 * round-trips automatically via `apiFetch`'s `credentials: 'include'` the
 * same way the cart cookie does. A logged-in request would resolve to the
 * user's own wishlist instead (`req.user` wins server-side) — moot today
 * since nothing in this app ever attaches an `Authorization` header (no
 * login exists — see `hooks/use-wishlist.ts`'s doc comment on
 * `mergeWishlistOnLogin`).
 */

export async function getWishlist(): Promise<Wishlist> {
  const { wishlist } = await apiFetch('/me/wishlist', WishlistResponse);
  return wishlist;
}

export async function addWishlistItem(input: { productId: string; variantId?: string | null }): Promise<Wishlist> {
  const { wishlist } = await apiFetch('/me/wishlist', WishlistResponse, { method: 'POST', body: input });
  return wishlist;
}

export async function removeWishlistItem(productId: string): Promise<Wishlist> {
  const { wishlist } = await apiFetch(`/me/wishlist/${encodeURIComponent(productId)}`, WishlistResponse, { method: 'DELETE' });
  return wishlist;
}

/**
 * `POST /me/wishlist/merge` — auth required, folds a guest wishlist
 * (identified by the `lulwah_wishlist_guest` cookie) into the now-
 * authenticated user's own, per `wishlist.controller.ts#merge`'s doc
 * comment. Exported and ready to use, but **nothing calls this yet** — see
 * `hooks/use-wishlist.ts`'s doc comment for exactly where and why.
 */
export async function mergeWishlistOnLogin(): Promise<Wishlist> {
  const { wishlist } = await apiFetch('/me/wishlist/merge', WishlistResponse, { method: 'POST', body: {} });
  return wishlist;
}
