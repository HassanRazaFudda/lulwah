import type { Wishlist } from '@lulwah/contracts';
import type { WishlistDoc, WishlistHydratedDoc } from './wishlist.model.js';

export function toWishlistDto(doc: WishlistDoc | WishlistHydratedDoc): Wishlist {
  return {
    id: doc._id.toString(),
    userId: doc.userId ? doc.userId.toString() : null,
    // `wishlist.model.ts`'s schema deliberately leaves whichever of
    // `userId`/`guestId` doesn't apply genuinely absent (`undefined`), not
    // explicitly `null` (see that file's doc comment on the sparse unique
    // indexes) — normalized to `null` here, since `Wishlist.guestId` in
    // `@lulwah/contracts` is `.nullable()`, not `.optional()`.
    guestId: doc.guestId ?? null,
    items: doc.items.map((item) => ({
      productId: item.productId.toString(),
      variantId: item.variantId ? item.variantId.toString() : null,
      addedAt: item.addedAt,
      priceAtAddFils: item.priceAtAddFils,
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
