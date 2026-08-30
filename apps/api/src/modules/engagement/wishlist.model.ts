import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * Mongoose schema for `wishlists` — plan.md §7.13: "userId|guestId,
 * items:[{productId,variantId,addedAt,priceAtAdd}] — price-drop email
 * hook." `engagement` owns this model (plan.md §5.3); only
 * `wishlist.repository.ts` may import it (§5.4).
 *
 * One document per identity (per logged-in `userId`, or per anonymous
 * `guestId` — see `config/constants.ts#WISHLIST_GUEST_COOKIE_NAME`),
 * exactly the same guest/logged-in split `cart.model.ts#CartDoc` uses,
 * except a wishlist has no cookie-carried external *resource* id of its
 * own (every route is `/me/wishlist*`, never `/wishlist/:id`) — so unlike
 * `Cart`, which is looked up by its own `cartId`, a `Wishlist` is looked up
 * directly by `userId` or `guestId`. `merge on login` (plan.md's
 * `cart.merge` precedent) is intentionally NOT built here — a later
 * workstream's job per the brief — but the userId/guestId split below is
 * exactly what that merge step will need: find the guest doc by
 * `guestId`, find (or create) the user's doc by `userId`, union the two
 * `items[]` arrays, done.
 */

export interface WishlistItemSubdoc {
  productId: Types.ObjectId;
  variantId: Types.ObjectId | null;
  addedAt: Date;
  priceAtAddFils: number;
}

const wishlistItemSchema = new Schema<WishlistItemSubdoc>(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    variantId: { type: Schema.Types.ObjectId, default: null },
    addedAt: { type: Date, required: true, default: () => new Date() },
    priceAtAddFils: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

export interface WishlistDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId | null;
  guestId: string | null;
  items: Types.DocumentArray<WishlistItemSubdoc>;
  createdAt: Date;
  updatedAt: Date;
}

const wishlistSchema = new Schema<WishlistDoc>(
  {
    // Deliberately NO `default: null` on either field — a classic MongoDB
    // sparse-index gotcha: a sparse index only excludes documents where the
    // field is genuinely ABSENT, not documents where it's present with
    // value `null` (unlike, say, `cart.model.ts#CartDoc.userId`, which can
    // safely default to `null` because its own `{ userId: 1 }` index isn't
    // unique). With a `default: null` here, every guest document would
    // carry an explicit `userId: null` and collide with every OTHER guest
    // document on the unique `{ userId: 1 }` index — the write only fails
    // on the *second* guest wishlist ever created, so this is easy to miss
    // without a test that creates two. `wishlist.repository.ts
    // #findOrCreateWishlist` is the one place that constructs a new
    // document; it sets only the ONE identity field that actually applies,
    // leaving the other key genuinely unset (`undefined`, not `null`) —
    // exactly what makes the sparse index below behave as intended.
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    guestId: { type: String },
    items: { type: [wishlistItemSchema], default: [] },
  },
  { timestamps: true, collection: 'wishlists' },
);

// At most one wishlist document per identity. `sparse` so the many
// documents with the *other* identity field genuinely absent don't collide
// on the unique index — see the doc comment on the schema fields above for
// why "absent" (not "null") is the operative word.
wishlistSchema.index({ userId: 1 }, { unique: true, sparse: true });
wishlistSchema.index({ guestId: 1 }, { unique: true, sparse: true });

export type WishlistHydratedDoc = HydratedDocument<WishlistDoc>;
export const WishlistModel = model<WishlistDoc>('Wishlist', wishlistSchema);
