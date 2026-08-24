import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { sendSuccess } from '../../shared/response.js';
import { requireAuthedUser } from './catalog.controller-utils.js';
import * as service from './category.service.js';
import { AdminCreateCategoryInput, AdminListCategoriesQuery, AdminUpdateCategoryInput } from './category.dto.js';

export async function getTree(_req: Request, res: Response): Promise<void> {
  const categories = await service.getCategoryTree();
  sendSuccess(res, { categories });
}

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = AdminListCategoriesQuery.parse(req.query);
  const { categories, total } = await service.adminListCategories(actor, query.page, query.limit);
  sendSuccess(res, { categories }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const category = await service.adminGetCategory(actor, objectId.parse(req.params.id));
  sendSuccess(res, { category });
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminCreateCategoryInput.parse(req.body);
  const category = await service.createCategory(actor, input);
  sendSuccess(res, { category }, undefined, 201);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminUpdateCategoryInput.parse(req.body);
  const category = await service.updateCategory(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { category });
}

export async function adminDelete(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  await service.deleteCategory(actor, objectId.parse(req.params.id));
  sendSuccess(res, {});
}
