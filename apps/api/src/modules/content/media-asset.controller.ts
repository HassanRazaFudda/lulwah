import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { sendSuccess } from '../../shared/response.js';
import { requireAuthedUser } from './content.controller-utils.js';
import * as service from './media-asset.service.js';
import { AdminCreateMediaAssetInput, AdminListMediaAssetsQuery, AdminUpdateMediaAssetInput, BulkUpdateMediaAssetsInput } from './media-asset.dto.js';

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = AdminListMediaAssetsQuery.parse(req.query);
  const { assets, total } = await service.adminListMediaAssets(
    actor,
    { folder: query.folder, search: query.search, tag: query.tag, type: query.type },
    query.page,
    query.limit,
  );
  sendSuccess(res, { assets }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function adminListFolders(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const folders = await service.adminListFolders(actor);
  sendSuccess(res, { folders });
}

export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const asset = await service.adminGetMediaAsset(actor, objectId.parse(req.params.id));
  sendSuccess(res, { asset });
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminCreateMediaAssetInput.parse(req.body);
  const asset = await service.createMediaAsset(actor, input);
  sendSuccess(res, { asset }, undefined, 201);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminUpdateMediaAssetInput.parse(req.body);
  const asset = await service.updateMediaAsset(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { asset });
}

export async function adminBulkUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = BulkUpdateMediaAssetsInput.parse(req.body);
  const assets = await service.bulkUpdateMediaAssets(actor, input);
  sendSuccess(res, { assets });
}

export async function adminDelete(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  await service.deleteMediaAsset(actor, objectId.parse(req.params.id));
  sendSuccess(res, {});
}
