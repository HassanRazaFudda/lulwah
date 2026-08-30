import { Types } from 'mongoose';
import type { Wishlist } from '@lulwah/contracts';
import { notFoundError, validationError } from '../../shared/errors.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import { assertPermission } from '../identity/identity.policy.js';
// Read-only cross-module calls through each module's exported service
// interface, per plan.md §5.3 — never their repositories/models.
import * as productService from '../catalog/product.service.js';
import * as variantService from '../catalog/variant.service.js';
import * as repo from './wishlist.repository.js';
import type { WishlistIdentity } from './wishlist.repository.js';
import type { WishlistHydratedDoc, WishlistItemSubdoc } from './wishlist.model.js';
import { toWishlistDto } from './wishlist.mapper.js';
import type { AddWishlistItemInput } from './wishlist.dto.js';

/**
 * ALL wishlist business rules live here, framework-free (no `express` —
 * plan.md §5.4). `wishlist.controller.ts` only parses/shapes + resolves the
 * guest/logged-in identity from the request; `wishlist.repository.ts` only
 * persists.
 */

export type { WishlistIdentity };

export async function getMyWishlist(identity: WishlistIdentity): Promise<Wishlist> {
  const doc = await repo.findOrCreateWishlist(identity);
  return toWishlistDto(doc);
}

/**
 * `POST /me/wishlist` — plan.md §9.4. `priceAtAddFils` is always
 * server-resolved (never the client's number — same "never trust a
 * client-supplied price" rule `cart.service.ts#addItem` already follows
 * for `unitPriceFils`): the variant's current price when `variantId` is
 * given, else the product's current `effectivePriceFils`. Adding a product
 * already on the list is a no-op (idempotent), matched by `productId`
 * alone — a wishlist entry is deduped per-product, not per-variant (see
 * `wishlist.model.ts`'s doc comment on why `variantId` is just metadata,
 * not a distinguishing key: `DELETE /me/wishlist/:productId` only ever
 * takes a `productId`, so uniqueness has to live at that same grain).
 */
export async function addItemToWishlist(identity: WishlistIdentity, input: AddWishlistItemInput): Promise<Wishlist> {
  const product = await productService.getProductById(input.productId);
  if (!product) throw notFoundError('Product not found.');

  let priceAtAddFils = product.effectivePriceFils;
  if (input.variantId) {
    const variant = await variantService.getVariantById(input.variantId);
    if (!variant || variant.productId !== input.productId) {
      throw validationError('This variant does not belong to the given product.', 'variantId');
    }
    priceAtAddFils = variant.priceFils;
  }

  const doc = await repo.findOrCreateWishlist(identity);
  const alreadyWishlisted = doc.items.some((item) => item.productId.toString() === input.productId);
  if (!alreadyWishlisted) {
    doc.items.push({
      productId: new Types.ObjectId(product.id),
      variantId: input.variantId ? new Types.ObjectId(input.variantId) : null,
      addedAt: new Date(),
      priceAtAddFils,
    } as WishlistItemSubdoc);
    await repo.save(doc);
  }
  return toWishlistDto(doc);
}

export async function removeItemFromWishlist(identity: WishlistIdentity, productId: string): Promise<Wishlist> {
  const doc = await repo.findOrCreateWishlist(identity);
  // `WishlistItemSubdoc` has no `_id` (unlike `cart.items`, which removes
  // via `Types.DocumentArray#pull(itemId)`) — `productId` is the only key a
  // wishlist item has, so filter-and-reassign is the natural removal here.
  // Mongoose casts a plain array back onto a `DocumentArray` path on
  // assignment; same "cast once at the boundary" pattern
  // `cart.service.ts#mergeBothCarts` uses for its own bulk `items` write.
  doc.items = doc.items.filter((item) => item.productId.toString() !== productId) as unknown as WishlistHydratedDoc['items'];
  await repo.save(doc);
  return toWishlistDto(doc);
}

/**
 * `POST /me/wishlist/merge` — plan.md §9.4's "guest + synced" wishlist,
 * same "call this once, right after a successful login" trigger
 * `cart.service.ts#mergeCartOnLogin` already establishes for cart (the
 * frontend passes the guestId it already has from its cookie). Union of
 * items by `productId`; on a collision the user's own existing entry wins
 * (its `addedAt`/`priceAtAddFils` stay untouched) — it's the one they saved
 * while actually signed in, same tie-break direction `mergeBothCarts`
 * doesn't need to make (cart merges by `max(qty)`, wishlist items have no
 * quantity to compare, just presence). The now-redundant guest document is
 * deleted afterward — see `wishlist.repository.ts#deleteWishlist`'s own
 * comment on why nothing else can reach it once merged.
 */
export async function mergeWishlistOnLogin(guestId: string | null, userId: string): Promise<Wishlist> {
  const guestDoc = guestId ? await repo.findWishlistByIdentity({ userId: null, guestId }) : null;
  const userDoc = await repo.findOrCreateWishlist({ userId, guestId: null });
  if (!guestDoc) return toWishlistDto(userDoc);

  const existingProductIds = new Set(userDoc.items.map((item) => item.productId.toString()));
  for (const item of guestDoc.items) {
    if (!existingProductIds.has(item.productId.toString())) {
      userDoc.items.push({
        productId: item.productId,
        variantId: item.variantId,
        addedAt: item.addedAt,
        priceAtAddFils: item.priceAtAddFils,
      } as WishlistItemSubdoc);
    }
  }
  await repo.save(userDoc);
  await repo.deleteWishlist(guestDoc._id.toString());
  return toWishlistDto(userDoc);
}

/**
 * `GET /admin/customers/:id/wishlist` — plan.md §11.1's Customer detail
 * screen ("wishlist, reviews"). `wishlist` has no permission string of its
 * own (it's a self-service `/me/*` resource — see this module's report),
 * so this admin read is gated by the already-existing `customers.read`
 * instead — the same reliance-on-the-caller's-check `cart.service
 * .ts#getActiveCartForUser` has for its own "current cart contents" read in
 * `customer.service.ts#adminGetCustomer` (no `assertPermission` call inside
 * `cart` at all; the route mounting it is what's gated). Here the
 * permission check has to be explicit at this function's own boundary
 * instead of purely at the route, because this route lives in
 * `engagement.routes.ts`, not behind `customer`'s own already-gated
 * `/admin/customers/:id` handler.
 */
export async function adminGetWishlistForCustomer(actor: AuthenticatedUser, userId: string): Promise<Wishlist | null> {
  assertPermission(actor, 'customers.read');
  const doc = await repo.findWishlistByIdentity({ userId, guestId: null });
  return doc ? toWishlistDto(doc) : null;
}
