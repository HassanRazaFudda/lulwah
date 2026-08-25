import { z } from 'zod';
import { Cart, CartItem, objectId } from '@lulwah/contracts';
import { CART_MAX_QTY_PER_LINE } from '../../config/constants.js';

/**
 * Request/response DTOs for `cart` — plan.md §9.5. `Cart`/`CartItem`
 * themselves live in `@lulwah/contracts` (reused, not redefined); the
 * per-item response view below adds two fields the wire schema doesn't
 * carry — `priceChanged`/`availableStock` — because they're this
 * endpoint's own read-time computation, not persisted state (same "a
 * response envelope's `data` shape belongs local to the module that
 * produces it" pattern `identity.dto.ts` documents for its own responses).
 */

export const AddCartItemInput = z.object({
  variantId: objectId,
  quantity: z.number().int().positive().max(CART_MAX_QTY_PER_LINE),
});
export type AddCartItemInput = z.infer<typeof AddCartItemInput>;

export const UpdateCartItemInput = z.object({
  quantity: z.number().int().positive().max(CART_MAX_QTY_PER_LINE),
});
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemInput>;

export const ApplyCouponInput = z.object({
  code: z.string().min(1),
});
export type ApplyCouponInput = z.infer<typeof ApplyCouponInput>;

/**
 * plan.md §8.5: "compare snapshot vs current [price]. If changed, update
 * it silently and surface a non-blocking notice" — `priceChanged` is that
 * notice. `availableStock` is the variant's live `inventory.available`
 * right now, so a client can tell a line's quantity exceeds what's
 * actually reservable without the API guessing what UI treatment that
 * deserves (plan.md: "the storefront surfaces the actual UI notice later,
 * not your concern").
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
