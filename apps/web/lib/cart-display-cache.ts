/**
 * A real gap in the current `cart` API surface (plan.md §7.10 / `cart.
 * dto.ts`, out of this workstream's scope — `apps/api` isn't touched here):
 * `CartItem` only carries `productId`/`variantId`/`quantity`/prices, never
 * a title/brand/image snapshot — unlike `checkout`'s `CheckoutSessionItemView`
 * and `order`'s `OrderItem`, which both snapshot `titleSnapshot`/
 * `brandSnapshot`/`imageSnapshot` at creation time (plan.md §7.11's
 * "snapshot rule"). There is also no public catalog endpoint that resolves
 * a bare `productId`/`variantId` back into display data (`GET /products/
 * :slug` is slug-only, no batch-by-id lookup exists) — so a cart line
 * loaded from a cookie alone genuinely cannot be rendered with a photo or
 * title from the API today.
 *
 * This is a **local-only, cosmetic** cache — never a source of truth for
 * quantity, price, or totals (those always come from the real `CartResponse`
 * server data, per plan.md §8.5). `AddToBagForm` already has full PDP
 * product/variant data at the moment it adds a line, so it remembers the
 * display fields here, keyed by `variantId` (cart has one line per
 * variant); the cart page reads them back to render a photo/title, falling
 * back to a plain placeholder for a variant this browser never saw added
 * (a cart resumed on a different device, or a cleared `localStorage`) —
 * degraded but honest, never fabricated.
 */
export interface CartLineDisplay {
  productSlug: string;
  brandName: string;
  title: string;
  image: { src: string; alt: string };
  stitchingType: string;
  colorName?: string;
  size?: string;
}

const STORAGE_KEY = 'lulwah-cart-display-cache';

function readCache(): Record<string, CartLineDisplay> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CartLineDisplay>;
  } catch {
    return {};
  }
}

export function getCartLineDisplay(variantId: string): CartLineDisplay | undefined {
  return readCache()[variantId];
}

export function rememberCartLineDisplay(variantId: string, display: CartLineDisplay): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = readCache();
    cache[variantId] = display;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Private-mode/quota failures degrade to the plain-placeholder render — never fatal.
  }
}
