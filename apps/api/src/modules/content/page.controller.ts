import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { sendSuccess } from '../../shared/response.js';
import { requireAuthedUser } from './content.controller-utils.js';
import * as service from './page.service.js';
import { AdminCreatePageInput, AdminListPagesQuery, AdminUpdatePageInput } from './page.dto.js';

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = AdminListPagesQuery.parse(req.query);
  const { pages, total } = await service.adminListPages(actor, query.status, query.page, query.limit);
  sendSuccess(res, { pages }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const page = await service.adminGetPage(actor, objectId.parse(req.params.id));
  sendSuccess(res, { page });
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminCreatePageInput.parse(req.body);
  const page = await service.createPage(actor, input);
  sendSuccess(res, { page }, undefined, 201);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminUpdatePageInput.parse(req.body);
  const page = await service.updatePage(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { page });
}

export async function adminDelete(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  await service.deletePage(actor, objectId.parse(req.params.id));
  sendSuccess(res, {});
}

export async function getPublicBySlug(req: Request, res: Response): Promise<void> {
  const page = await service.getPublicPageBySlug(req.params.slug as string);
  sendSuccess(res, { page });
}
