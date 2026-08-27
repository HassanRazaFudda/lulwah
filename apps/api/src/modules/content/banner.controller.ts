import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { sendSuccess } from '../../shared/response.js';
import { requireAuthedUser } from './content.controller-utils.js';
import * as service from './banner.service.js';
import { AdminCreateBannerInput, AdminUpdateBannerInput, ListBannersQuery } from './banner.dto.js';

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = ListBannersQuery.parse(req.query);
  const banners = await service.adminListBanners(actor, query.placement);
  sendSuccess(res, { banners });
}

export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const banner = await service.adminGetBanner(actor, objectId.parse(req.params.id));
  sendSuccess(res, { banner });
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminCreateBannerInput.parse(req.body);
  const banner = await service.createBanner(actor, input);
  sendSuccess(res, { banner }, undefined, 201);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminUpdateBannerInput.parse(req.body);
  const banner = await service.updateBanner(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { banner });
}

export async function adminDelete(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  await service.deleteBanner(actor, objectId.parse(req.params.id));
  sendSuccess(res, {});
}

export async function listPublic(req: Request, res: Response): Promise<void> {
  const query = ListBannersQuery.parse(req.query);
  const banners = await service.listPublicBanners(query.placement);
  sendSuccess(res, { banners });
}
