import type { PublicReview, Review } from '@lulwah/contracts';
import { AppError, notFoundError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
// Read-only cross-module calls through each module's exported service
// interface, per plan.md §5.3 — never their repositories/models.
import * as productService from '../catalog/product.service.js';
import * as orderService from '../order/order.service.js';
import * as repo from './review.repository.js';
import { toPublicReviewDto, toReviewDto } from './review.mapper.js';
import { toMediaRefSubdoc } from './media-ref.mapper.js';
import { engagementEvents } from './engagement.events.js';
import type { AdminReplyToReviewInput, AdminUpdateReviewStatusInput, CreateReviewInput } from './review.dto.js';

/**
 * ALL review business rules live here, framework-free (no `express` —
 * plan.md §5.4). `review.controller.ts` only parses/shapes; `review
 * .repository.ts` only persists.
 */

function isDuplicateReviewError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

/**
 * `POST /me/reviews` — plan.md §9.4. `isVerifiedPurchase`/`orderId` are
 * ALWAYS derived here from a real `order.service.ts` lookup, never taken
 * from `input` (there is no such field on `CreateReviewInput` to begin
 * with) — the brief's own requirement: "checked server-side, never trusted
 * from the client." A shopper with no matching delivered order still gets
 * to submit the review (real e-commerce sites allow this — plan.md's own
 * framing) with `isVerifiedPurchase: false`, not a rejection.
 *
 * Every new review starts `status: 'pending'` — never auto-approved,
 * regardless of verification status.
 */
export async function createMyReview(actor: AuthenticatedUser, input: CreateReviewInput): Promise<Review> {
  const product = await productService.getProductById(input.productId);
  if (!product) throw notFoundError('Product not found.');

  const orderId = await orderService.findDeliveredOrderForProduct(actor.id, input.productId);

  try {
    const doc = await repo.createReview({
      productId: input.productId,
      orderId,
      userId: actor.id,
      rating: input.rating,
      title: input.title,
      body: input.body,
      media: input.media.map(toMediaRefSubdoc),
      fitFeedback: input.fitFeedback,
      isVerifiedPurchase: orderId !== null,
    });
    engagementEvents.publish('review.submitted', { reviewId: doc._id.toString(), productId: input.productId, userId: actor.id });
    return toReviewDto(doc);
  } catch (err) {
    if (isDuplicateReviewError(err)) {
      throw new AppError('CONFLICT', 409, { messageEn: 'You have already reviewed this product.', field: 'productId' });
    }
    throw err;
  }
}

/** `GET /products/:id/reviews` — plan.md §9.2. Public; `status: 'approved'`
 *  only (enforced in `review.repository.ts`, not re-filtered here). */
export async function getPublicReviewsForProduct(productId: string, page: number, limit: number, sort: 'recent' | 'helpful' | 'rating'): Promise<{ reviews: PublicReview[]; total: number }> {
  const { reviews, total } = await repo.listApprovedReviewsForProduct(productId, page, limit, sort);
  return { reviews: reviews.map(toPublicReviewDto), total };
}

// ---------------------------------------------------------------------------
// Admin moderation — plan.md §11.1's Customer detail "reviews" panel and a
// new moderation queue this module designs following the codebase's own
// `/admin/*` conventions (see `engagement.routes.ts`'s doc comment).
// ---------------------------------------------------------------------------

export async function adminListReviews(actor: AuthenticatedUser, status: Review['status'] | undefined, page: number, limit: number): Promise<{ reviews: Review[]; total: number }> {
  assertPermission(actor, 'reviews.read');
  const { reviews, total } = await repo.adminListReviews({ status }, page, limit);
  return { reviews: reviews.map(toReviewDto), total };
}

/** `PATCH /admin/reviews/:id/status` — approve/reject. */
export async function adminUpdateReviewStatus(actor: AuthenticatedUser, id: string, input: AdminUpdateReviewStatusInput): Promise<Review> {
  assertPermission(actor, 'reviews.write');
  const doc = await repo.findReviewById(id);
  if (!doc) throw notFoundError('Review not found.');
  doc.status = input.status;
  await repo.save(doc);
  return toReviewDto(doc);
}

/** `PATCH /admin/reviews/:id/reply` — plan.md's `adminReply` field. */
export async function adminReplyToReview(actor: AuthenticatedUser, id: string, input: AdminReplyToReviewInput): Promise<Review> {
  assertPermission(actor, 'reviews.write');
  const doc = await repo.findReviewById(id);
  if (!doc) throw notFoundError('Review not found.');
  doc.adminReply = input.adminReply;
  await repo.save(doc);
  return toReviewDto(doc);
}

/**
 * `GET /admin/customers/:id/reviews` — plan.md §11.1's Customer detail
 * screen ("wishlist, reviews"). Gated by `reviews.read` (the data being
 * read is review data, regardless of whose) rather than `customers.read` —
 * same "each sub-resource read enforces its own module's permission"
 * pattern `customer.service.ts#adminGetCustomer` already establishes by
 * having `orderService.adminListOrders`/`orderService.getCustomerOrderStats`
 * each assert `orders.read` internally rather than trusting a blanket
 * `customers.read` check made once upstream. Does not itself verify `id` is
 * a real `role: 'customer'` user — a bogus id just yields an empty list,
 * the same "no upstream existence check needed for a sub-resource keyed by
 * id" posture `orderService.adminListOrders(actor, { userId: id })` takes.
 */
export async function adminListReviewsForCustomer(actor: AuthenticatedUser, userId: string, page: number, limit: number): Promise<{ reviews: Review[]; total: number }> {
  assertPermission(actor, 'reviews.read');
  const { reviews, total } = await repo.adminListReviews({ userId }, page, limit);
  return { reviews: reviews.map(toReviewDto), total };
}
