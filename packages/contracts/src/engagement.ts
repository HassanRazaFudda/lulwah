import { z } from 'zod';
import { objectId } from './common.js';
import { Fils } from './money.js';
import { MediaRef } from './product.js';

/**
 * Engagement — plan.md §7.13 (`reviews`, `wishlists`) and §5.3's module
 * table ("Review, Wishlist, Newsletter, NotifyMe, Notification templates").
 * Only `Review`/`Wishlist` are built this phase (plan.md P4's "reviews,
 * wishlist sync" deliverable) — `Newsletter`/`NotifyMe`/notification
 * templates are a separate, not-yet-scoped workstream, so this file is
 * deliberately narrower than the full module table.
 */

// ---------------------------------------------------------------------------
// Review — plan.md §7.13's field list, verbatim.
// ---------------------------------------------------------------------------

export const ReviewFitFeedback = z.enum(['small', 'true', 'large']);
export type ReviewFitFeedback = z.infer<typeof ReviewFitFeedback>;

export const ReviewStatus = z.enum(['pending', 'approved', 'rejected']);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const Review = z.object({
  id: objectId,
  productId: objectId,
  // `null` until a matching completed order is found server-side (see
  // `review.service.ts#createMyReview`) — never client-supplied.
  orderId: objectId.nullable(),
  userId: objectId,
  rating: z.number().int().min(1).max(5),
  title: z.string(),
  body: z.string(),
  media: z.array(MediaRef),
  fitFeedback: ReviewFitFeedback.nullable(),
  // Server-computed only — see `review.service.ts`'s doc comment. Never
  // trusted from the client.
  isVerifiedPurchase: z.boolean(),
  status: ReviewStatus,
  adminReply: z.string().nullable(),
  helpfulCount: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Review = z.infer<typeof Review>;

/**
 * The public-facing shape a storefront PDP reads — `GET /products/:id/reviews`
 * only ever returns `status: 'approved'` rows (enforced in
 * `review.repository.ts`, not just filtered client-side), so `status` is
 * dropped here too (always implicitly `'approved'`). `orderId`/`userId` are
 * also dropped — internal linkage, not something a storefront reader needs
 * or should see. Same "narrower public projection of the admin entity"
 * pattern as `content.ts`'s `PublicPage`.
 */
export const PublicReview = Review.omit({ orderId: true, userId: true, status: true });
export type PublicReview = z.infer<typeof PublicReview>;

// ---------------------------------------------------------------------------
// Wishlist — plan.md §7.13's field list, verbatim, except `priceAtAdd` is
// spelled `priceAtAddFils` here to match this codebase's own money-field
// convention (plan.md §27.2: "every money field elsewhere is suffixed
// `Fils`") — the same kind of documented delta from the plan's own
// abbreviated table other modules' contracts already carry (e.g.
// `page.dto.ts` vs. the `pages` table row).
// ---------------------------------------------------------------------------

export const WishlistItem = z.object({
  productId: objectId,
  // Nullable — a shopper can wishlist a product before picking a specific
  // size/colour (unlike `cart`, which always requires a concrete variant to
  // add to the bag). When set, it's the variant that was in view at the
  // moment of adding.
  variantId: objectId.nullable(),
  addedAt: z.coerce.date(),
  priceAtAddFils: Fils,
});
export type WishlistItem = z.infer<typeof WishlistItem>;

export const Wishlist = z.object({
  id: objectId,
  // Exactly one of `userId`/`guestId` is non-null — the same guest/
  // logged-in identity split `cart.ts`'s `Cart` uses (there: `userId`
  // nullable, always with a `sessionId`; here: `userId` nullable, paired
  // with a nullable `guestId` instead of an always-present session key,
  // since a wishlist has no cookie-carried external resource id of its own
  // to key off — see `wishlist.model.ts`'s doc comment).
  userId: objectId.nullable(),
  guestId: z.string().nullable(),
  items: z.array(WishlistItem),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Wishlist = z.infer<typeof Wishlist>;
