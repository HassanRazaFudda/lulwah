import { apiFetch } from './api-client';
import { CartResponse } from './cart-schemas';

/**
 * Thin fetch functions over `apiFetch` for the real `cart` module
 * (`apps/api/src/modules/cart/cart.routes.ts`) — `POST /cart`,
 * `GET /cart/:cartId`, item add/update/remove, coupon apply/remove.
 *
 * The cart id itself needs no client-side state management beyond reading
 * it back from a response/cookie (see the task brief): `POST /cart` sets a
 * non-httpOnly `lulwah_cart` cookie (plan.md §8.5) that round-trips on every
 * subsequent `credentials: 'include'` fetch automatically. `getCartIdFromCookie`
 * reads that same cookie client-side so `useCart` (hooks/use-cart.ts) can
 * decide whether to `GET` an existing cart or `POST` a fresh one, without a
 * second source of truth for "what is my cart id" ever existing.
 */

const CART_COOKIE_NAME = 'lulwah_cart';

export function getCartIdFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CART_COOKIE_NAME}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * `POST /cart`/`GET /cart/:cartId` return the same cart regardless of its
 * `status` — after a successful `checkout/session/:id/place`, `cart.
 * service.ts#convertCart` marks the cart `'converted'` but the cookie still
 * points at it and its (now-purchased) items are still populated
 * server-side. Left alone, the next visit to the cart page — or the next
 * `POST /cart` a fresh `AddToBagForm` add would trigger — would keep
 * reusing that same converted cart. Clearing the cookie client-side (it's
 * not httpOnly, plan.md §8.5, precisely so the storefront can read/manage
 * it) forces the next `useCart()` read to mint a brand-new one via
 * `createCart()`. Called once, right after a successful `place`.
 */
export function clearCartCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${CART_COOKIE_NAME}=; Max-Age=0; path=/`;
}

export async function createCart(): Promise<CartResponse> {
  return apiFetch('/cart', CartResponse, { method: 'POST', body: {} });
}

export async function getCart(cartId: string): Promise<CartResponse> {
  return apiFetch(`/cart/${encodeURIComponent(cartId)}`, CartResponse);
}

export async function addCartItem(cartId: string, input: { variantId: string; quantity: number }): Promise<CartResponse> {
  return apiFetch(`/cart/${encodeURIComponent(cartId)}/items`, CartResponse, { method: 'POST', body: input });
}

export async function updateCartItemQuantity(cartId: string, itemId: string, quantity: number): Promise<CartResponse> {
  return apiFetch(`/cart/${encodeURIComponent(cartId)}/items/${encodeURIComponent(itemId)}`, CartResponse, {
    method: 'PATCH',
    body: { quantity },
  });
}

export async function removeCartItem(cartId: string, itemId: string): Promise<CartResponse> {
  return apiFetch(`/cart/${encodeURIComponent(cartId)}/items/${encodeURIComponent(itemId)}`, CartResponse, {
    method: 'DELETE',
  });
}

export async function applyCoupon(cartId: string, code: string): Promise<CartResponse> {
  return apiFetch(`/cart/${encodeURIComponent(cartId)}/coupon`, CartResponse, { method: 'POST', body: { code } });
}

export async function removeCoupon(cartId: string): Promise<CartResponse> {
  return apiFetch(`/cart/${encodeURIComponent(cartId)}/coupon`, CartResponse, { method: 'DELETE' });
}
