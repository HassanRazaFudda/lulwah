import { z } from 'zod';
import { Wishlist, objectId } from '@lulwah/contracts';

/** `POST /me/wishlist` — plan.md §9.4. `variantId` is optional: a shopper
 *  can wishlist a product before choosing a variant (see `wishlist.model.ts`'s
 *  doc comment). `priceAtAddFils` is never accepted from the client — the
 *  server always re-resolves it from the real product/variant record
 *  (`wishlist.service.ts`), same "never trust a client-supplied price"
 *  posture `cart`'s `AddCartItemInput` already establishes. */
export const AddWishlistItemInput = z.object({
  productId: objectId,
  variantId: objectId.nullable().optional(),
});
export type AddWishlistItemInput = z.infer<typeof AddWishlistItemInput>;

export const WishlistResponse = z.object({ wishlist: Wishlist });
export type WishlistResponse = z.infer<typeof WishlistResponse>;
