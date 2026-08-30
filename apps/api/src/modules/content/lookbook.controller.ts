import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { sendSuccess } from '../../shared/response.js';
import { requireAuthedUser } from './content.controller-utils.js';
import * as service from './lookbook.service.js';
import { AdminCreateLookbookInput, AdminListLookbooksQuery, AdminUpdateLookbookInput } from './lookbook.dto.js';

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = AdminListLookbooksQuery.parse(req.query);
  const { lookbooks, total } = await service.adminListLookbooks(actor, query.status, query.page, query.limit);
  sendSuccess(res, { lookbooks }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const lookbook = await service.adminGetLookbook(actor, objectId.parse(req.params.id));
  sendSuccess(res, { lookbook });
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminCreateLookbookInput.parse(req.body);
  const lookbook = await service.createLookbook(actor, input);
  sendSuccess(res, { lookbook }, undefined, 201);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminUpdateLookbookInput.parse(req.body);
  const lookbook = await service.updateLookbook(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { lookbook });
}

export async function adminDelete(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  await service.deleteLookbook(actor, objectId.parse(req.params.id));
  sendSuccess(res, {});
}

export async function listPublic(_req: Request, res: Response): Promise<void> {
  const lookbooks = await service.listPublicLookbooks();
  sendSuccess(res, { lookbooks });
}

export async function getPublicBySlug(req: Request, res: Response): Promise<void> {
  const lookbook = await service.getPublicLookbookBySlug(req.params.slug as string);
  sendSuccess(res, { lookbook });
}
