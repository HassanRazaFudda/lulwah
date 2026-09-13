import { z } from 'zod';
import { PublicReview, Review } from '@lulwah/contracts';

/**
 * Response-shape schemas for the `engagement` module's review endpoints
 * (`apps/api/src/modules/engagement/review.dto.ts`) — same "re-declare a
 * module-local response DTO from shared `@lulwah/contracts` primitives"
 * pattern `catalog-schemas.ts`/`cart-schemas.ts` already establish, since
 * `apps/web` can't import from `apps/api/src/*` directly (plan.md §5.2).
 */

// --- GET /products/:id/reviews (public, approved-only) ----------------------
export const PublicReviewListResponse = z.object({ reviews: z.array(PublicReview) });
export type PublicReviewListResponse = z.infer<typeof PublicReviewListResponse>;

// --- POST /me/reviews --------------------------------------------------------
// Returns the full `Review` (not `PublicReview`) — it's the author's own
// just-created row, including fields (`status`, `orderId`) `PublicReview`
// omits, per `review.controller.ts#createMy`.
export const ReviewResponse = z.object({ review: Review });
export type ReviewResponse = z.infer<typeof ReviewResponse>;
