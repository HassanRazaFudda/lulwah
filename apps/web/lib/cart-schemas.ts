import { z } from 'zod';
import { Cart, CartItem } from '@lulwah/contracts';

/**
 * Response-shape schemas for the `cart` module (`apps/api/src/modules/cart/
 * cart.dto.ts`). `Cart`/`CartItem` themselves live in `@lulwah/contracts`
 * (reused as-is); `CartResponse`/`CartItemView` add the two read-time-only
 * fields (`priceChanged`/`availableStock`) that `cart.dto.ts` documents as
 * never persisted — same "re-declare a module-local DTO with shared
 * primitives" pattern `catalog-schemas.ts` already establishes for the
 * catalog module's own composite response shapes.
 */
export const CartItemView = CartItem.extend({
  priceChanged: z.boolean(),
  availableStock: z.number().int(),
});
export type CartItemView = z.infer<typeof CartItemView>;

export const CartResponse = Cart.omit({ items: true }).extend({
  items: z.array(CartItemView),
});
export type CartResponse = z.infer<typeof CartResponse>;
