'use client';

import { useState } from 'react';
import { cx } from '@lulwah/ui';
import { useProductReviews } from '@/hooks/use-reviews';
import type { ReviewSort } from '@/lib/review-client';
import { ReviewCard } from './ReviewCard';
import { ReviewSummary } from './ReviewSummary';
import { WriteReviewForm } from './WriteReviewForm';

const PAGE_SIZE = 10;

const SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: 'recent', label: 'Most recent' },
  { value: 'helpful', label: 'Most helpful' },
  { value: 'rating', label: 'Highest rated' },
];

const SELECT_CLASSES = cx(
  'h-40 border border-ink-20 bg-nacre px-12 font-body text-body-sm text-ink outline-none',
  'focus:border-zamurrad',
);

/**
 * PDP reviews section — plan.md §15.4 item 13: "Reviews (R2) with rating
 * distribution and fit feedback." Wired to the real, live
 * `GET /products/:id/reviews` (public, approved-only — `review.repository
 * .ts` enforces that server-side, not re-filtered here). `productId` is the
 * product's real Mongo id, not its slug — the one PDP fetch that isn't
 * slug-keyed (see `lib/review-client.ts`'s doc comment).
 */
export function ReviewsSection({ productId }: { productId: string; productTitle: string }) {
  const [sort, setSort] = useState<ReviewSort>('recent');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useProductReviews(productId, page, sort, PAGE_SIZE);
  const reviews = data?.reviews ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleSortChange(next: ReviewSort) {
    setSort(next);
    setPage(1);
  }

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="flex flex-col gap-24 border-t border-line pt-48">
      <div className="flex flex-wrap items-center justify-between gap-16">
        <h2 id="reviews-heading" className="font-display text-heading-1 tracking-display text-ink">
          Reviews
        </h2>
        <WriteReviewForm productId={productId} />
      </div>

      <ReviewSummary productId={productId} />

      {isLoading ? (
        <div className="flex flex-col gap-24">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-96 animate-pulse bg-nacre" aria-hidden="true" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="font-body text-body text-ink-70">
          No reviews yet — be the first to share what you think of this piece.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-16">
            <span className="font-body text-body-sm text-mukaish">
              {total} review{total === 1 ? '' : 's'}
            </span>
            <label className="flex items-center gap-8">
              <span className="font-body text-body-sm text-mukaish">Sort by</span>
              <select
                value={sort}
                onChange={(e) => handleSortChange(e.target.value as ReviewSort)}
                className={SELECT_CLASSES}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={cx('flex flex-col gap-24', isFetching && 'opacity-60')}>
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-16 pt-8">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="font-body text-body-sm text-ink underline decoration-1 underline-offset-4 disabled:cursor-not-allowed disabled:text-ink-20 disabled:no-underline"
              >
                Previous
              </button>
              <span className="font-body text-body-sm text-mukaish">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="font-body text-body-sm text-ink underline decoration-1 underline-offset-4 disabled:cursor-not-allowed disabled:text-ink-20 disabled:no-underline"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
