import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { sendSuccess } from '../../shared/response.js';
import { requireAuthedUser } from './catalog.controller-utils.js';
import * as service from './product.service.js';
import { getAdminProductDetail } from './variant.service.js';
import { AdminCreateProductInput, AdminListProductsQuery, AdminUpdateProductInput, ListProductsQuery } from './product.dto.js';

/** Parse+validate (Zod) → call service → shape response. No business logic
 *  (plan.md §5.4). Public product routes (§9.2) and the admin product CRUD
 *  routes (§9.7) live in one file since they're both thin wrappers over
 *  `product.service.ts`; variants/media get their own file
 *  (`variant.controller.ts`) to stay under the §27.3 300-line limit. */

// --- public — plan.md §9.2 --------------------------------------------------

export async function listPublic(req: Request, res: Response): Promise<void> {
  const query = ListProductsQuery.parse(req.query);
  const { products, total } = await service.listProducts(query);
  sendSuccess(res, { products }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function getPublicBySlug(req: Request, res: Response): Promise<void> {
  const detail = await service.getProductDetailBySlug(req.params.slug as string);
  sendSuccess(res, detail);
}

export async function getRelated(req: Request, res: Response): Promise<void> {
  const limit = req.query.limit ? Number(req.query.limit) : 4;
  const products = await service.getRelatedProducts(req.params.slug as string, limit);
  sendSuccess(res, { products });
}

// --- admin — plan.md §9.7 ---------------------------------------------------

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = AdminListProductsQuery.parse(req.query);
  const { products, total } = await service.adminListProducts(actor, query);
  sendSuccess(res, { products }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminCreateProductInput.parse(req.body);
  const product = await service.createProduct(actor, input);
  sendSuccess(res, { product }, undefined, 201);
}

/** `variant.service.ts` owns this because it needs to merge in live stock
 *  per variant — the editor's single GET returns product + variants
 *  together (plan.md §9.7 `GET /admin/products/:id`). */
export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const detail = await getAdminProductDetail(actor, objectId.parse(req.params.id));
  sendSuccess(res, detail);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminUpdateProductInput.parse(req.body);
  const product = await service.updateProduct(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { product });
}

export async function adminDelete(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  await service.deleteProduct(actor, objectId.parse(req.params.id));
  sendSuccess(res, {});
}
