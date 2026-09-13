'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createReview, listProductReviews, type CreateReviewInput, type ReviewSort } from '@/lib/review-client';

/**
 * TanStack Query over the real `engagement` review endpoints — same
 * structural shape `hooks/use-cart.ts` establishes for `cart` (plan.md
 * §12.3). Reviews are read-heavy and public, so unlike cart there's no
 * optimistic-with-rollback story for the *list* — `useCreateReview` is the
 * one mutation, and it can't optimistically insert its own result anyway
 * (a freshly-submitted review is always `status: 'pending'`, so it would
 * never actually show up in the approved-only public list it just
 * invalidated — inserting it optimistically would be a lie about what the
 * next page's own fetch will show).
 */

const REVIEWS_QUERY_KEY = (productId: string) => ['reviews', productId] as const;

/** `GET /products/:id/reviews`, paginated + sorted. `keepPreviousData` keeps
 *  the prior page's rows on screen (rather than flashing a loading state)
 *  while a new page/sort is in flight — the same UX `PLP`'s own pagination
 *  favors. */
export function useProductReviews(productId: string, page: number, sort: ReviewSort, limit = 10) {
  return useQuery({
    queryKey: [...REVIEWS_QUERY_KEY(productId), { page, sort, limit }],
    queryFn: () => listProductReviews(productId, { page, sort, limit }),
    placeholderData: keepPreviousData,
  });
}

/**
 * A separate, larger, `sort=recent`-fixed fetch used only to compute the
 * rating-distribution / fit-feedback summary (plan.md §15.4 item 13:
 * "rating distribution and fit feedback"). There is no dedicated
 * aggregate/summary endpoint (`review.dto.ts` only exposes the paginated
 * list) and this is public read-only data — apps/api is explicitly out of
 * scope for this workstream, so this samples the most recent
 * `REVIEW_SUMMARY_SAMPLE_SIZE` approved reviews (the API's own per-request
 * max) rather than fabricating a distribution. `total` (from the response
 * envelope's real `meta.total`, not the sample length) is still the exact
 * total review count — only the *distribution shape* is a sample once a
 * product has more reviews than the sample size. `ReviewsSection` labels
 * the summary honestly when that happens rather than presenting a sample
 * as if it were exact.
 */
export const REVIEW_SUMMARY_SAMPLE_SIZE = 50;

export function useProductReviewSummary(productId: string) {
  return useQuery({
    queryKey: [...REVIEWS_QUERY_KEY(productId), 'summary'],
    queryFn: () => listProductReviews(productId, { page: 1, limit: REVIEW_SUMMARY_SAMPLE_SIZE, sort: 'recent' }),
  });
}

/**
 * `POST /me/reviews`. Requires a real logged-in session — see
 * `lib/review-client.ts#createReview`'s doc comment: this storefront has no
 * login anywhere, so this mutation will genuinely 401 (`AUTH_FORBIDDEN`)
 * every time it's called today. That's surfaced as real `mutation.error`
 * state, not swallowed — `ReviewsSection`'s write-review form reads
 * `error.code`/`error.httpStatus` off it to show "sign in to write a
 * review" honestly instead of a generic failure message.
 */
export function useCreateReview(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateReviewInput, 'productId'>) => createReview({ ...input, productId }),
    onSuccess: () => {
      // A newly-created review starts `pending` and won't appear in the
      // approved-only list this invalidates until an admin approves it —
      // invalidating anyway is still correct: it's what makes the summary/
      // list refetch and reflect reality the moment that admin action
      // happens, without a stale cached "reviews" query masking it.
      void queryClient.invalidateQueries({ queryKey: REVIEWS_QUERY_KEY(productId) });
    },
  });
}
