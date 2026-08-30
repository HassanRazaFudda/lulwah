import { WishlistModel } from './wishlist.model.js';
import type { WishlistHydratedDoc } from './wishlist.model.js';

/**
 * The ONLY file allowed to touch `WishlistModel` (plan.md §5.4).
 * `wishlist.service.ts` decides what a wishlist *means*; this file only
 * executes the query it's told to.
 */

export interface WishlistIdentity {
  userId: string | null;
  guestId: string | null;
}

export async function findWishlistByIdentity(identity: WishlistIdentity): Promise<WishlistHydratedDoc | null> {
  if (identity.userId) return WishlistModel.findOne({ userId: identity.userId }).exec();
  if (identity.guestId) return WishlistModel.findOne({ guestId: identity.guestId }).exec();
  return null;
}

/** `upsert`-style find-or-create — a shopper's first wishlist read/write
 *  has no document yet, and every route (`GET|POST /me/wishlist`, `DELETE
 *  /me/wishlist/:productId`) needs one to exist before it can act. Race-safe
 *  under concurrent first-time requests for the same identity via Mongo's
 *  own atomic `findOneAndUpdate(..., { upsert: true })` rather than a
 *  read-then-create round trip. */
export async function findOrCreateWishlist(identity: WishlistIdentity): Promise<WishlistHydratedDoc> {
  // Sets ONLY the one identity field that applies — never both, and never
  // the other one to `null` — so the field that doesn't apply stays
  // genuinely absent on the new document. See `wishlist.model.ts`'s doc
  // comment on the sparse unique indexes for why that distinction matters:
  // an explicit `null` on the unused field would collide with every other
  // guest (or every other logged-in) document on that field's unique index.
  const filter = identity.userId ? { userId: identity.userId } : { guestId: identity.guestId };
  const setOnInsert = identity.userId ? { userId: identity.userId, items: [] } : { guestId: identity.guestId, items: [] };
  const doc = await WishlistModel.findOneAndUpdate(filter, { $setOnInsert: setOnInsert }, { upsert: true, returnDocument: 'after' }).exec();
  // `findOneAndUpdate` with `upsert: true` always returns a document — the
  // null case only exists at the type level (see
  // `order.repository.ts#nextOrderNumber`'s identical comment on its own
  // upsert).
  if (!doc) throw new Error('findOrCreateWishlist: unexpected null result');
  return doc;
}

export async function save(doc: WishlistHydratedDoc): Promise<WishlistHydratedDoc> {
  return doc.save();
}
