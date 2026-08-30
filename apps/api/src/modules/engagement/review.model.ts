import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { mediaRefSchema } from './media-ref.schema.js';
import type { MediaRefSubdoc } from './media-ref.schema.js';

/**
 * Mongoose schema for `reviews` — plan.md §7.13: "productId, orderId,
 * userId, rating 1-5, title, body, media[], fitFeedback:'small'|'true'|'large',
 * isVerifiedPurchase, status:'pending'|'approved'|'rejected', adminReply,
 * helpfulCount". `engagement` owns this model (plan.md §5.3); only
 * `review.repository.ts` may import it (§5.4).
 *
 * `isVerifiedPurchase`/`orderId` are always computed by `review.service.ts`
 * from a real `order` lookup, never taken from request input — see that
 * file's doc comment.
 */

export type ReviewFitFeedback = 'small' | 'true' | 'large';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewDoc {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  orderId: Types.ObjectId | null;
  userId: Types.ObjectId;
  rating: number;
  title: string;
  body: string;
  media: MediaRefSubdoc[];
  fitFeedback: ReviewFitFeedback | null;
  isVerifiedPurchase: boolean;
  status: ReviewStatus;
  adminReply: string | null;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<ReviewDoc>(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    orderId: { type: Schema.Types.ObjectId, default: null },
    userId: { type: Schema.Types.ObjectId, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    media: { type: [mediaRefSchema], default: [] },
    fitFeedback: { type: String, enum: ['small', 'true', 'large'], default: null },
    isVerifiedPurchase: { type: Boolean, required: true, default: false },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], required: true, default: 'pending' },
    adminReply: { type: String, default: null },
    helpfulCount: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true, collection: 'reviews' },
);

// plan.md §7.14: { productId:1, status:1, createdAt:-1 } — the exact index
// `GET /products/:id/reviews` (approved-only, sorted) needs.
reviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
// `GET /admin/customers/:id/reviews` — a customer's own review history.
reviewSchema.index({ userId: 1, createdAt: -1 });
// One review per shopper per product — a real, standard e-commerce
// constraint (`review.service.ts#isDuplicateReviewError` maps a violation
// to `409 CONFLICT`), not explicitly in plan.md's abbreviated field list but
// a natural, low-risk extension of it.
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

export type ReviewHydratedDoc = HydratedDocument<ReviewDoc>;
export const ReviewModel = model<ReviewDoc>('Review', reviewSchema);
