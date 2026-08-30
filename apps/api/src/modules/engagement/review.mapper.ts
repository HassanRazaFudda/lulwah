import type { PublicReview, Review } from '@lulwah/contracts';
import type { ReviewDoc, ReviewHydratedDoc } from './review.model.js';
import { toMediaRefDto } from './media-ref.mapper.js';

export function toReviewDto(doc: ReviewDoc | ReviewHydratedDoc): Review {
  return {
    id: doc._id.toString(),
    productId: doc.productId.toString(),
    orderId: doc.orderId ? doc.orderId.toString() : null,
    userId: doc.userId.toString(),
    rating: doc.rating,
    title: doc.title,
    body: doc.body,
    media: doc.media.map(toMediaRefDto),
    fitFeedback: doc.fitFeedback,
    isVerifiedPurchase: doc.isVerifiedPurchase,
    status: doc.status,
    adminReply: doc.adminReply,
    helpfulCount: doc.helpfulCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Drops `orderId`/`userId`/`status` — see `PublicReview`'s own doc comment
 *  in `@lulwah/contracts` for why. */
export function toPublicReviewDto(doc: ReviewDoc | ReviewHydratedDoc): PublicReview {
  return {
    id: doc._id.toString(),
    productId: doc.productId.toString(),
    rating: doc.rating,
    title: doc.title,
    body: doc.body,
    media: doc.media.map(toMediaRefDto),
    fitFeedback: doc.fitFeedback,
    isVerifiedPurchase: doc.isVerifiedPurchase,
    adminReply: doc.adminReply,
    helpfulCount: doc.helpfulCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
