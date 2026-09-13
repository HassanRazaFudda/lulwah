'use client';

import { useState, type FormEvent } from 'react';
import { Button, Input, cx } from '@lulwah/ui';
import type { ReviewFitFeedback } from '@lulwah/contracts';
import { ApiError } from '@/lib/api-client';
import { useCreateReview } from '@/hooks/use-reviews';
import { ReviewStars } from './ReviewStars';

const FIT_OPTIONS: { value: ReviewFitFeedback; label: string }[] = [
  { value: 'small', label: 'Runs small' },
  { value: 'true', label: 'True to size' },
  { value: 'large', label: 'Runs large' },
];

const TEXTAREA_CLASSES = cx(
  'w-full resize-y rounded-none border-0 border-b border-ink-20 bg-nacre px-16 py-16',
  'text-body text-ink outline-none transition-colors duration-base ease-out',
  'focus:border-b-2 focus:border-zamurrad',
);

/**
 * "Write a review" — plan.md §15.4 item 13's entry point. `POST /me/reviews`
 * requires a real logged-in session (`requireLoggedIn()` in
 * `engagement.routes.ts`), and **this storefront has no login/register page
 * anywhere** — confirmed by grepping the whole of `apps/web` before writing
 * this (see the task report for the full finding: no token storage, no
 * `Authorization` header ever attached by `lib/api-client.ts`, `account/
 * orders/page.tsx` documents the same gap for order history).
 *
 * Rather than faking a client-side "you must sign in" gate ahead of ever
 * trying the real endpoint, this form is fully real and always submits for
 * real — `useCreateReview` — and reads the *actual* rejection back
 * (`AUTH_FORBIDDEN`, HTTP 401) to show honest copy. The moment a real
 * customer-login flow exists elsewhere in this app and starts attaching a
 * real `Authorization` header, this form starts working with zero changes
 * here — that's the point of not special-casing "no login" client-side.
 */
export function WriteReviewForm({ productId }: { productId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [fitFeedback, setFitFeedback] = useState<ReviewFitFeedback | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const mutation = useCreateReview(productId);

  const isAuthError =
    mutation.error instanceof ApiError && (mutation.error.httpStatus === 401 || mutation.error.code === 'AUTH_FORBIDDEN');
  const genericErrorMessage =
    mutation.error instanceof ApiError && !isAuthError ? mutation.error.message : mutation.error ? 'Something went wrong. Please try again.' : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setValidationError(null);
    if (rating < 1) {
      setValidationError('Select a rating.');
      return;
    }
    if (!title.trim()) {
      setValidationError('Add a title for your review.');
      return;
    }
    if (!body.trim()) {
      setValidationError('Write a few words about the product.');
      return;
    }
    try {
      await mutation.mutateAsync({
        rating,
        title: title.trim(),
        body: body.trim(),
        fitFeedback,
        // No image-upload pipeline exists anywhere in this codebase yet
        // (same honest "paste-a-URL" scope call `apps/admin`'s product
        // media tab already makes) — `publicId` is set to the pasted URL
        // itself since there's no separate CDN asset id to have here.
        media: photoUrl.trim() ? [{ publicId: photoUrl.trim(), url: photoUrl.trim() }] : [],
      });
      setSubmitted(true);
      setRating(0);
      setTitle('');
      setBody('');
      setFitFeedback(null);
      setPhotoUrl('');
    } catch {
      // Surfaced via `mutation.error` above.
    }
  }

  if (!isOpen) {
    return (
      <Button type="button" variant="secondary" onClick={() => setIsOpen(true)}>
        Write a review
      </Button>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-8 border border-line p-24">
        <p className="font-body text-body font-medium text-ink">Thanks for your review.</p>
        <p className="font-body text-body-sm text-ink-70">
          It's been submitted and will appear here once our team approves it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-16 border border-line p-24">
      <div className="flex items-center justify-between">
        <h3 className="font-body text-body font-semibold text-ink">Write a review</h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="font-body text-body-sm text-mukaish underline decoration-1 underline-offset-4"
        >
          Cancel
        </button>
      </div>

      <div className="flex flex-col gap-8">
        <span className="font-body text-label font-semibold tracking-label text-ink uppercase">Rating</span>
        <ReviewStars rating={rating} size={24} onChange={setRating} label="Your rating" />
      </div>

      <Input label="Review title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />

      <div className="flex flex-col gap-4">
        <label htmlFor="review-body" className="font-body text-label font-semibold tracking-label text-ink uppercase">
          Your review
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          rows={4}
          className={TEXTAREA_CLASSES}
        />
      </div>

      <div className="flex flex-col gap-8">
        <span className="font-body text-label font-semibold tracking-label text-ink uppercase">Fit (optional)</span>
        <div className="flex flex-wrap gap-8">
          {FIT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={fitFeedback === option.value}
              onClick={() => setFitFeedback(fitFeedback === option.value ? null : option.value)}
              className={cx(
                'h-40 border px-16 font-body text-body-sm transition-colors duration-fast ease-out',
                fitFeedback === option.value ? 'border-zamurrad bg-zamurrad text-paper' : 'border-ink-20 text-ink hover:border-ink',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <Input
        label="Photo URL (optional)"
        hint="Paste a link to a photo — there's no upload yet"
        value={photoUrl}
        onChange={(e) => setPhotoUrl(e.target.value)}
        type="url"
      />

      {validationError ? (
        <p role="alert" className="font-body text-body-sm text-danger">
          {validationError}
        </p>
      ) : null}

      {isAuthError ? (
        <p role="alert" className="font-body text-body-sm text-danger">
          Sign in to write a review. Storefront sign-in isn't available yet — this is a known gap, not a bug.
        </p>
      ) : genericErrorMessage ? (
        <p role="alert" className="font-body text-body-sm text-danger">
          {genericErrorMessage}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={mutation.isPending}>
        {mutation.isPending ? 'Submitting…' : 'Submit review'}
      </Button>
    </form>
  );
}
