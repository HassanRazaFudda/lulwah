import type { QueryFilter, SortOrder } from 'mongoose';
import { ReviewModel } from './review.model.js';
import type { ReviewDoc, ReviewHydratedDoc } from './review.model.js';
import type { MediaRefSubdoc } from './media-ref.schema.js';

/**
 * The ONLY file allowed to touch `ReviewModel` (plan.md §5.4).
 * `review.service.ts` decides what a review *means*; this file only
 * executes the query it's told to.
 */

export interface CreateReviewInput {
  productId: string;
  orderId: string | null;
  userId: string;
  rating: number;
  title: string;
  body: string;
  media: MediaRefSubdoc[];
  fitFeedback: ReviewDoc['fitFeedback'];
  isVerifiedPurchase: boolean;
}

export async function createReview(input: CreateReviewInput): Promise<ReviewHydratedDoc> {
  // Every id field above is a plain string (what `review.service.ts`
  // actually has, having already resolved them from other modules' DTOs),
  // not `ReviewDoc`'s Mongoose-native `Types.ObjectId` — Mongoose casts at
  // the DB boundary regardless; this only papers over `.create()`'s
  // overload resolution, same cast `page.repository.ts#createPage` uses.
  const doc = { ...input, status: 'pending', adminReply: null, helpfulCount: 0 } as unknown as Parameters<typeof ReviewModel.create>[0];
  return ReviewModel.create(doc);
}

export async function findReviewById(id: string): Promise<ReviewHydratedDoc | null> {
  return ReviewModel.findOne({ _id: id }).exec();
}

export async function save(doc: ReviewHydratedDoc): Promise<ReviewHydratedDoc> {
  return doc.save();
}

const SORT_SPEC: Record<'recent' | 'helpful' | 'rating', Record<string, SortOrder>> = {
  recent: { createdAt: -1 },
  helpful: { helpfulCount: -1, createdAt: -1 },
  rating: { rating: -1, createdAt: -1 },
};

/** `GET /products/:id/reviews` — plan.md §9.2. `status: 'approved'` only,
 *  enforced here (not left to the controller/service to remember). */
export async function listApprovedReviewsForProduct(
  productId: string,
  page: number,
  limit: number,
  sort: 'recent' | 'helpful' | 'rating',
): Promise<{ reviews: ReviewHydratedDoc[]; total: number }> {
  const query: QueryFilter<ReviewDoc> = { productId, status: 'approved' };
  const [reviews, total] = await Promise.all([
    ReviewModel.find(query)
      .sort(SORT_SPEC[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    ReviewModel.countDocuments(query).exec(),
  ]);
  return { reviews, total };
}

export interface AdminReviewListFilter {
  status?: ReviewDoc['status'] | undefined;
  productId?: string | undefined;
  userId?: string | undefined;
}

export async function adminListReviews(filter: AdminReviewListFilter, page: number, limit: number): Promise<{ reviews: ReviewHydratedDoc[]; total: number }> {
  const query: QueryFilter<ReviewDoc> = {};
  if (filter.status) query.status = filter.status;
  if (filter.productId) query.productId = filter.productId;
  if (filter.userId) query.userId = filter.userId;

  const [reviews, total] = await Promise.all([
    ReviewModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    ReviewModel.countDocuments(query).exec(),
  ]);
  return { reviews, total };
}
