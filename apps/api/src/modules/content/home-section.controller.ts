import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { sendSuccess } from '../../shared/response.js';
import { requireAuthedUser } from './content.controller-utils.js';
import * as service from './home-section.service.js';
import { AdminCreateHomeSectionInput, AdminUpdateHomeSectionInput, ReorderHomeSectionsInput } from './home-section.dto.js';

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const sections = await service.adminListHomeSections(actor);
  sendSuccess(res, { sections });
}

export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const section = await service.adminGetHomeSection(actor, objectId.parse(req.params.id));
  sendSuccess(res, { section });
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminCreateHomeSectionInput.parse(req.body);
  const section = await service.createHomeSection(actor, input);
  sendSuccess(res, { section }, undefined, 201);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminUpdateHomeSectionInput.parse(req.body);
  const section = await service.updateHomeSection(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { section });
}

export async function adminDelete(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  await service.deleteHomeSection(actor, objectId.parse(req.params.id));
  sendSuccess(res, {});
}

export async function adminReorder(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = ReorderHomeSectionsInput.parse(req.body);
  const sections = await service.reorderHomeSections(actor, input.orderedIds);
  sendSuccess(res, { sections });
}

export async function getPublicHome(_req: Request, res: Response): Promise<void> {
  const sections = await service.listPublicHomeSections();
  sendSuccess(res, { sections });
}
