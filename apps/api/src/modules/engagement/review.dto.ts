import { z } from 'zod';
import { MediaRef, PublicReview, Review, ReviewFitFeedback, ReviewStatus, objectId } from '@lulwah/contracts';

/**
 * `POST /me/reviews` — plan.md §9.4. Deliberately does NOT accept
 * `orderId`/`isVerifiedPurchase`/`status`/`adminReply`/`helpfulCount` —
 * every one of those is either server-computed (`isVerifiedPurchase`,
 * `orderId` — see `review.service.ts`) or admin-only (`status`,
 * `adminReply`) or has no client-write path at all (`helpfulCount`, not
 * built this phase — see `review.model.ts`'s doc comment).
 */
export const CreateReviewInput = z.object({
  productId: objectId,
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  media: z.array(MediaRef).max(10).default([]),
  fitFeedback: ReviewFitFeedback.nullable().default(null),
});
export type CreateReviewInput = z.infer<typeof CreateReviewInput>;

/** `GET /products/:id/reviews` — plan.md §9.2. */
export const PublicListReviewsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  sort: z.enum(['recent', 'helpful', 'rating']).default('recent'),
});
export type PublicListReviewsQuery = z.infer<typeof PublicListReviewsQuery>;

/** `GET /admin/reviews` — moderation queue, and reused (without `status`
 *  narrowed to a query default) by `GET /admin/customers/:id/reviews`. */
export const AdminListReviewsQuery = z.object({
  status: ReviewStatus.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type AdminListReviewsQuery = z.infer<typeof AdminListReviewsQuery>;

/** `PATCH /admin/reviews/:id/status` — approve/reject only; a review can't
 *  be moved back to `pending` once decided (no admin action re-queues it,
 *  and there's no product need for that state transition either). */
export const AdminUpdateReviewStatusInput = z.object({
  status: z.enum(['approved', 'rejected']),
});
export type AdminUpdateReviewStatusInput = z.infer<typeof AdminUpdateReviewStatusInput>;

/** `PATCH /admin/reviews/:id/reply` — plan.md's `adminReply` field. */
export const AdminReplyToReviewInput = z.object({
  adminReply: z.string().min(1).max(2000),
});
export type AdminReplyToReviewInput = z.infer<typeof AdminReplyToReviewInput>;

export const ReviewListResponse = z.object({ reviews: z.array(Review) });
export type ReviewListResponse = z.infer<typeof ReviewListResponse>;

export const ReviewResponse = z.object({ review: Review });
export type ReviewResponse = z.infer<typeof ReviewResponse>;

export const PublicReviewListResponse = z.object({ reviews: z.array(PublicReview) });
export type PublicReviewListResponse = z.infer<typeof PublicReviewListResponse>;
