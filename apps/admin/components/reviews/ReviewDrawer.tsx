'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Review } from '@lulwah/contracts';
import { formatDateTime } from '@lulwah/utils';
import { Button } from '@lulwah/ui';
import { ReviewStatusPill } from '../ReviewStatusPill';
import { textareaClassName } from '../product-editor/field-styles';

export interface ReviewDrawerProps {
  review: Review;
  productLabel: string;
  productHref: string;
  customerLabel: string;
  customerHref: string;
  /** `lib/permissions.ts#canWriteReviews` — see that file's doc comment on
   *  why this is a client-side courtesy, not the real enforcement. */
  canWrite: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReply: (text: string) => void;
  isUpdatingStatus: boolean;
  isReplying: boolean;
  onClose: () => void;
}

/**
 * Same right-side drawer shape `AuditEntryDrawer.tsx` establishes —
 * overlay + slide-in panel, Escape-to-close — reused here for a review's
 * full detail (body, media, fit feedback) plus the approve/reject/reply
 * moderation actions the audit log's own drawer has no need for.
 */
export function ReviewDrawer({
  review,
  productLabel,
  productHref,
  customerLabel,
  customerHref,
  canWrite,
  onApprove,
  onReject,
  onReply,
  isUpdatingStatus,
  isReplying,
  onClose,
}: ReviewDrawerProps) {
  const [replyDraft, setReplyDraft] = useState(review.adminReply ?? '');

  // Re-seeds the draft whenever a different review is opened, or when this
  // one's `adminReply` changes underneath it (e.g. after this same drawer's
  // own reply mutation lands) — mirrors `CustomerDetailPage`'s
  // `notesInitializedFor` precedent for "don't clobber an in-progress edit
  // on an unrelated background refetch," scoped here to "the review
  // identity changed" via the effect's own dependency array instead of a
  // ref, since a drawer unmounts/remounts per review (`key`-less but
  // conditionally rendered) rather than staying mounted across ids.
  useEffect(() => {
    setReplyDraft(review.adminReply ?? '');
  }, [review.id, review.adminReply]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const replyDirty = replyDraft.trim() !== (review.adminReply ?? '');

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div className="relative flex h-full w-full max-w-[560px] flex-col gap-16 overflow-y-auto border-l border-line bg-paper p-24">
        <div className="flex items-start justify-between gap-16">
          <div>
            <div className="flex items-center gap-8">
              <ReviewStatusPill status={review.status} size="sm" />
              {review.isVerifiedPurchase ? (
                <span className="text-[10px] font-semibold uppercase tracking-label text-zamurrad">Verified purchase</span>
              ) : null}
            </div>
            <p className="mt-4 text-body-sm text-ink-70">{formatDateTime(review.createdAt, 'en')}</p>
          </div>
          <button type="button" onClick={onClose} className="text-body-sm font-semibold text-ink-70 hover:text-ink">
            Close ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-16 border border-line bg-nacre p-16 text-body-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-label text-ink-70">Product</p>
            <Link href={productHref} className="text-zamurrad underline underline-offset-4">
              {productLabel}
            </Link>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-label text-ink-70">Customer</p>
            <Link href={customerHref} className="text-zamurrad underline underline-offset-4">
              {customerLabel}
            </Link>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-label text-ink-70">Rating</p>
            <p className="text-ink">{review.rating} / 5</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-label text-ink-70">Fit feedback</p>
            <p className="text-ink">{review.fitFeedback ?? '—'}</p>
          </div>
        </div>

        <div>
          <p className="text-label font-semibold uppercase tracking-label text-ink-70">{review.title}</p>
          <p className="mt-8 whitespace-pre-wrap text-body-sm text-ink">{review.body}</p>
        </div>

        {review.media.length > 0 ? (
          <div className="flex flex-wrap gap-8">
            {review.media.map((m, i) => (
              // Plain <img> — no imgproxy loader in local dev (plan.md
              // §8.3), same precedent every other pasted-URL preview in
              // this app already follows.
              <img key={i} src={m.url} alt="" className="h-[64px] w-[64px] border border-line object-cover" />
            ))}
          </div>
        ) : null}

        {canWrite && review.status === 'pending' ? (
          <div className="flex gap-8 border-t border-line pt-16">
            <Button type="button" onClick={onApprove} disabled={isUpdatingStatus}>
              {isUpdatingStatus ? 'Saving…' : 'Approve'}
            </Button>
            <Button type="button" variant="secondary" onClick={onReject} disabled={isUpdatingStatus}>
              Reject
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-8 border-t border-line pt-16">
          <span className="text-label font-semibold uppercase tracking-label text-ink-70">Admin reply</span>
          {canWrite ? (
            <>
              <textarea
                className={textareaClassName}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder="Reply to this customer's review…"
              />
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onReply(replyDraft.trim())}
                  disabled={!replyDirty || isReplying || replyDraft.trim().length === 0}
                >
                  {isReplying ? 'Saving…' : review.adminReply ? 'Update reply' : 'Post reply'}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-body-sm text-ink-70">{review.adminReply || 'No reply yet.'}</p>
          )}
        </div>
      </div>
    </div>
  );
}
