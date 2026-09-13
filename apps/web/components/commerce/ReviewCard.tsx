import type { PublicReview, ReviewFitFeedback } from '@lulwah/contracts';
import { ReviewStars } from './ReviewStars';

const FIT_LABEL: Record<ReviewFitFeedback, string> = {
  small: 'Runs small',
  true: 'True to size',
  large: 'Runs large',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * One review — plan.md §15.4 item 13's own field list: rating stars,
 * title, body, a "Verified purchase" badge when `isVerifiedPurchase`
 * (server-computed from a real delivered-order lookup, never client-
 * supplied — see `review.service.ts#createMyReview`'s doc comment), and
 * media thumbnails when present. `helpfulCount` is displayed but not
 * interactive — `review.dto.ts` documents there is no client-write path
 * for it this phase ("not built in this phase").
 */
export function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <article className="flex flex-col gap-8 border-b border-line pb-24">
      <div className="flex flex-wrap items-center gap-8">
        <ReviewStars rating={review.rating} size={14} />
        {review.isVerifiedPurchase ? (
          <span className="bg-nacre px-8 py-2 font-body text-label font-semibold tracking-label text-zamurrad uppercase">
            Verified purchase
          </span>
        ) : null}
        {review.fitFeedback ? (
          <span className="font-body text-body-sm text-mukaish">{FIT_LABEL[review.fitFeedback]}</span>
        ) : null}
      </div>

      <h3 className="font-body text-body font-semibold text-ink">{review.title}</h3>
      <p className="whitespace-pre-line font-body text-body text-ink-70">{review.body}</p>

      {review.media.length > 0 ? (
        <div className="flex flex-wrap gap-8 pt-4">
          {review.media.map((item) => (
            // Arbitrary customer-pasted URLs, not a known image host —
            // plain `<img>` rather than `next/image` (same reasoning
            // `ProductGallery`'s doc comment gives nowhere else needs to,
            // since every other image in this app comes from the seeded/
            // admin-managed catalogue, but a review photo genuinely can't
            // be allowlisted in advance).

            <img key={item.publicId} src={item.url} alt="" loading="lazy" className="size-64 object-cover" />
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between pt-4">
        <span className="font-body text-body-sm text-mukaish">{formatDate(review.createdAt)}</span>
        {review.helpfulCount > 0 ? (
          <span className="font-body text-body-sm text-mukaish">
            {review.helpfulCount} found this helpful
          </span>
        ) : null}
      </div>

      {review.adminReply ? (
        <div className="mt-4 flex flex-col gap-4 bg-nacre p-16">
          <span className="font-body text-label font-semibold tracking-label text-ink uppercase">Lulwah Fashion replied</span>
          <p className="font-body text-body-sm text-ink-70">{review.adminReply}</p>
        </div>
      ) : null}
    </article>
  );
}
