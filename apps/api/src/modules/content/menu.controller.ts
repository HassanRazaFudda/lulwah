import type { Request, Response } from 'express';
import { MenuLocation, objectId } from '@lulwah/contracts';
import { sendSuccess } from '../../shared/response.js';
import { requireAuthedUser } from './content.controller-utils.js';
import * as service from './menu.service.js';
import { AdminCreateMenuInput, AdminUpdateMenuInput } from './menu.dto.js';

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const menus = await service.adminListMenus(actor);
  sendSuccess(res, { menus });
}

export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const menu = await service.adminGetMenu(actor, objectId.parse(req.params.id));
  sendSuccess(res, { menu });
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminCreateMenuInput.parse(req.body);
  const menu = await service.createMenu(actor, input);
  sendSuccess(res, { menu }, undefined, 201);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminUpdateMenuInput.parse(req.body);
  const menu = await service.updateMenu(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { menu });
}

export async function adminDelete(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  await service.deleteMenu(actor, objectId.parse(req.params.id));
  sendSuccess(res, {});
}

export async function getPublicByLocation(req: Request, res: Response): Promise<void> {
  const location = MenuLocation.parse(req.params.key);
  const menu = await service.getPublicMenuByLocation(location);
  sendSuccess(res, { menu });
}
