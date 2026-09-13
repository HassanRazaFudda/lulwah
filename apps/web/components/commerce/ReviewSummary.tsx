'use client';

import type { ReviewFitFeedback } from '@lulwah/contracts';
import { REVIEW_SUMMARY_SAMPLE_SIZE, useProductReviewSummary } from '@/hooks/use-reviews';
import { ReviewStars } from './ReviewStars';

/**
 * plan.md §15.4 item 13: "Reviews (R2) with rating distribution and fit
 * feedback (\"Runs true to size — 82%\")". There is no dedicated summary/
 * aggregate endpoint in the real `engagement` API (`review.dto.ts` only
 * exposes the paginated list) and apps/api is out of scope for this
 * workstream, so this is computed here from the sample
 * `useProductReviewSummary` fetches (the most recent `REVIEW_SUMMARY_SAMPLE_SIZE`
 * approved reviews). The review **count** shown is always the real,
 * exact `meta.total` — only the *shape* of the distribution/fit-feedback
 * breakdown is a sample once a product has more reviews than that; the
 * "Based on the N most recent reviews" line only appears in that case, so
 * the summary never quietly overstates its own precision.
 */
const FIT_LABEL: Record<ReviewFitFeedback, string> = {
  small: 'Runs small',
  true: 'Runs true to size',
  large: 'Runs large',
};

export function ReviewSummary({ productId }: { productId: string }) {
  const { data, isLoading } = useProductReviewSummary(productId);

  if (isLoading) {
    return <div className="h-[132px] animate-pulse bg-nacre" aria-hidden="true" />;
  }

  const reviews = data?.reviews ?? [];
  const total = data?.total ?? 0;
  if (reviews.length === 0) return null;

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    return { star, count, percent: reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0 };
  });

  const fitCounts = reviews.reduce<Record<ReviewFitFeedback, number>>(
    (acc, r) => {
      if (r.fitFeedback) acc[r.fitFeedback] += 1;
      return acc;
    },
    { small: 0, true: 0, large: 0 },
  );
  const fitTotal = fitCounts.small + fitCounts.true + fitCounts.large;
  const isSampled = total > reviews.length && reviews.length >= REVIEW_SUMMARY_SAMPLE_SIZE;

  return (
    <div className="flex flex-col gap-24 border border-line p-24 sm:flex-row sm:gap-48">
      <div className="flex flex-col items-start gap-8 sm:min-w-[140px]">
        <span className="font-display text-heading-1 tracking-display text-ink">{average.toFixed(1)}</span>
        <ReviewStars rating={average} size={18} />
        <span className="font-body text-body-sm text-mukaish">
          {total} review{total === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {distribution.map(({ star, count, percent }) => (
          <div key={star} className="flex items-center gap-8">
            <span className="w-48 shrink-0 font-body text-body-sm text-ink-70">{star} star</span>
            <div className="h-4 flex-1 bg-nacre">
              <div className="h-4 bg-gold-dark" style={{ width: `${percent}%` }} />
            </div>
            <span className="w-32 shrink-0 text-end font-body text-body-sm text-mukaish">{count}</span>
          </div>
        ))}
        {isSampled ? (
          <p className="pt-4 font-body text-body-sm text-mukaish">Based on the {reviews.length} most recent reviews.</p>
        ) : null}
      </div>

      {fitTotal > 0 ? (
        <div className="flex flex-col gap-8 sm:min-w-[200px]">
          <span className="font-body text-label font-semibold tracking-label text-ink uppercase">Fit</span>
          {(['small', 'true', 'large'] as const).map((key) =>
            fitCounts[key] > 0 ? (
              <p key={key} className="font-body text-body-sm text-ink-70">
                {FIT_LABEL[key]} — {Math.round((fitCounts[key] / fitTotal) * 100)}%
              </p>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}
