import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Review, ReviewStatus } from '@lulwah/contracts';
import { apiRequest, apiRequestWithMeta } from '../api-client';
import { buildQueryString } from './query-utils';

/**
 * Reviews moderation data-fetching layer — `GET /admin/reviews`, `PATCH
 * /admin/reviews/:id/status`, `PATCH /admin/reviews/:id/reply`
 * (`apps/api/src/modules/engagement/review.dto.ts` — read directly, not
 * guessed), plus `GET /admin/customers/:id/reviews` for the Customer
 * detail screen's own Reviews panel (same endpoint family, a different
 * consumer).
 *
 * `AdminListReviewsQuery.status` is optional server-side — omitted means
 * every status, matching this screen's "all" filter option.
 *
 * `GET /admin/reviews` is genuinely paginated server-side (a moderation
 * queue can realistically outgrow one page, the same reasoning
 * `queries/audit.ts`'s own doc comment gives for its identical choice), so
 * this uses `apiRequestWithMeta` rather than the "one generous page, no
 * pagination UI" shortcut most other admin list screens take.
 */

const AdminReviewListResponse = z.object({ reviews: z.array(Review) });
const AdminReviewResponse = z.object({ review: Review });

const REVIEWS_QUERY_KEY = ['admin', 'reviews'] as const;
const LIMIT = 50;

export interface AdminReviewsFilter {
  status?: ReviewStatus | undefined;
}

export function useAdminReviewsQuery(filter: AdminReviewsFilter, page: number) {
  return useQuery({
    queryKey: [...REVIEWS_QUERY_KEY, filter, page],
    queryFn: () =>
      apiRequestWithMeta(
        `/admin/reviews${buildQueryString({ status: filter.status, page, limit: LIMIT })}`,
        AdminReviewListResponse,
      ).then(({ data, meta }) => ({
        reviews: data.reviews,
        page: meta?.page ?? page,
        limit: meta?.limit ?? LIMIT,
        total: meta?.total ?? data.reviews.length,
        hasMore: meta?.hasMore ?? false,
      })),
    retry: false,
  });
}

/**
 * `GET /admin/customers/:id/reviews` — Customer detail's own Reviews
 * panel (plan.md §11.1: "wishlist, reviews" among the data an admin sees
 * there). A single customer's review count is small, so this fetches one
 * generous page (the endpoint's own max, 100) rather than adding a second
 * pager to that already-paginated screen — the same "one generous page"
 * precedent `queries/customers.ts`'s own doc comment documents for that
 * screen's sibling panels.
 */
export function useAdminCustomerReviewsQuery(customerId: string) {
  return useQuery({
    queryKey: ['admin', 'customer', customerId, 'reviews'],
    queryFn: () =>
      apiRequest(`/admin/customers/${customerId}/reviews${buildQueryString({ limit: 100 })}`, AdminReviewListResponse).then(
        (r) => r.reviews,
      ),
    enabled: customerId.length > 0,
  });
}

interface UpdateReviewStatusVars {
  id: string;
  status: 'approved' | 'rejected';
}

/** `PATCH /admin/reviews/:id/status` — a review can't be moved back to
 *  `pending` (no such transition exists server-side, per `review.dto.ts`'s
 *  own doc comment), so this mutation's vars are deliberately narrower
 *  than the full `ReviewStatus` enum. */
export function useUpdateReviewStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: UpdateReviewStatusVars) =>
      apiRequest(`/admin/reviews/${id}/status`, AdminReviewResponse, { method: 'PATCH', body: { status } }).then(
        (r) => r.review,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: REVIEWS_QUERY_KEY }),
  });
}

interface ReplyToReviewVars {
  id: string;
  adminReply: string;
}

export function useReplyToReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, adminReply }: ReplyToReviewVars) =>
      apiRequest(`/admin/reviews/${id}/reply`, AdminReviewResponse, { method: 'PATCH', body: { adminReply } }).then(
        (r) => r.review,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: REVIEWS_QUERY_KEY }),
  });
}
