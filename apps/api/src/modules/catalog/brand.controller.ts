import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { sendSuccess } from '../../shared/response.js';
import { requireAuthedUser } from './catalog.controller-utils.js';
import * as service from './brand.service.js';
import { AdminCreateBrandInput, AdminListBrandsQuery, AdminUpdateBrandInput } from './brand.dto.js';

/** Parse+validate (Zod) → call service → shape response. No business logic
 *  (plan.md §5.4). */

export async function listPublic(_req: Request, res: Response): Promise<void> {
  const brands = await service.listPublicBrands();
  sendSuccess(res, { brands });
}

export async function getPublicBySlug(req: Request, res: Response): Promise<void> {
  const brand = await service.getBrandBySlug(req.params.slug as string);
  sendSuccess(res, brand);
}

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = AdminListBrandsQuery.parse(req.query);
  const { brands, total } = await service.adminListBrands(actor, query.page, query.limit);
  sendSuccess(res, { brands }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const brand = await service.adminGetBrand(actor, objectId.parse(req.params.id));
  sendSuccess(res, { brand });
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminCreateBrandInput.parse(req.body);
  const brand = await service.createBrand(actor, input);
  sendSuccess(res, { brand }, undefined, 201);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminUpdateBrandInput.parse(req.body);
  const brand = await service.updateBrand(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { brand });
}

export async function adminDelete(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  await service.deleteBrand(actor, objectId.parse(req.params.id));
  sendSuccess(res, {});
}
