import type { MediaRef, PublicReview, Review, ReviewFitFeedback } from '@lulwah/contracts';
import { apiFetch, apiFetchWithMeta } from './api-client';
import { PublicReviewListResponse, ReviewResponse } from './review-schemas';

/**
 * Thin fetch functions over `apiFetch`/`apiFetchWithMeta` for the real
 * `engagement` module's review endpoints (`apps/api/src/modules/engagement/
 * review.routes.ts`) — `GET /products/:id/reviews` (public) and
 * `POST /me/reviews` (real login required, see `useCreateReview`'s doc
 * comment in `hooks/use-reviews.ts` for what that means on this storefront
 * today). Param names match `PublicListReviewsQuery` (`review.dto.ts`)
 * exactly: `page`/`limit`/`sort`, where `sort` is one of
 * `'recent' | 'helpful' | 'rating'`.
 *
 * Note the route takes the product's real Mongo `id`, not its `slug` —
 * unlike every other public catalog read in `catalog-client.ts`.
 */

export type ReviewSort = 'recent' | 'helpful' | 'rating';

export interface ListProductReviewsParams {
  page?: number;
  limit?: number;
  sort?: ReviewSort;
}

export interface ListProductReviewsResult {
  reviews: PublicReview[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listProductReviews(productId: string, params: ListProductReviewsParams = {}): Promise<ListProductReviewsResult> {
  const query = buildQueryString({ page: params.page, limit: params.limit, sort: params.sort });
  const { data, meta } = await apiFetchWithMeta(`/products/${encodeURIComponent(productId)}/reviews${query}`, PublicReviewListResponse);
  return {
    reviews: data.reviews,
    page: meta?.page ?? params.page ?? 1,
    limit: meta?.limit ?? params.limit ?? 20,
    total: meta?.total ?? data.reviews.length,
    hasMore: meta?.hasMore ?? false,
  };
}

export interface CreateReviewInput {
  productId: string;
  rating: number;
  title: string;
  body: string;
  fitFeedback?: ReviewFitFeedback | null;
  media?: MediaRef[];
}

/**
 * `POST /me/reviews` — `review.dto.ts#CreateReviewInput`. Requires a real
 * `Authorization: Bearer <accessToken>` header (`requireAuth()` — see
 * `identity.policy.ts`); `apiFetch` never attaches one because nothing in
 * `apps/web` ever obtains a token (no login page exists — see this
 * storefront's task report for the full finding). Calling this from a
 * browser today will reliably reject with `AUTH_FORBIDDEN` (401) — a real
 * rejection from a real endpoint, not a simulated one. `useCreateReview`
 * (hooks/use-reviews.ts) is what turns that into honest UI copy.
 */
export async function createReview(input: CreateReviewInput): Promise<Review> {
  const { review } = await apiFetch('/me/reviews', ReviewResponse, {
    method: 'POST',
    body: {
      productId: input.productId,
      rating: input.rating,
      title: input.title,
      body: input.body,
      fitFeedback: input.fitFeedback ?? null,
      media: input.media ?? [],
    },
  });
  return review;
}
