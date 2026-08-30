import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { sendSuccess } from '../../shared/response.js';
import { requireAuthedUser } from './engagement.controller-utils.js';
import * as service from './review.service.js';
import { AdminListReviewsQuery, AdminReplyToReviewInput, AdminUpdateReviewStatusInput, CreateReviewInput, PublicListReviewsQuery } from './review.dto.js';

/** Parse+validate (Zod) → call service → shape response. No business logic
 *  (plan.md §5.4). */

export async function createMy(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = CreateReviewInput.parse(req.body);
  const review = await service.createMyReview(actor, input);
  sendSuccess(res, { review }, undefined, 201);
}

/** `GET /products/:id/reviews` — plan.md §9.2, public. */
export async function getPublicForProduct(req: Request, res: Response): Promise<void> {
  const productId = objectId.parse(req.params.id);
  const query = PublicListReviewsQuery.parse(req.query);
  const { reviews, total } = await service.getPublicReviewsForProduct(productId, query.page, query.limit, query.sort);
  sendSuccess(res, { reviews }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = AdminListReviewsQuery.parse(req.query);
  const { reviews, total } = await service.adminListReviews(actor, query.status, query.page, query.limit);
  sendSuccess(res, { reviews }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function adminUpdateStatus(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminUpdateReviewStatusInput.parse(req.body);
  const review = await service.adminUpdateReviewStatus(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { review });
}

export async function adminReply(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminReplyToReviewInput.parse(req.body);
  const review = await service.adminReplyToReview(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { review });
}

/** `GET /admin/customers/:id/reviews` — plan.md §11.1's Customer detail
 *  screen. */
export async function adminListForCustomer(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const customerId = objectId.parse(req.params.id);
  const query = AdminListReviewsQuery.parse(req.query);
  const { reviews, total } = await service.adminListReviewsForCustomer(actor, customerId, query.page, query.limit);
  sendSuccess(res, { reviews }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}
