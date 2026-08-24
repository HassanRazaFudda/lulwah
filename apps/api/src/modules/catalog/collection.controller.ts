import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { sendSuccess } from '../../shared/response.js';
import { requireAuthedUser } from './catalog.controller-utils.js';
import * as service from './collection.service.js';
import { AdminCreateCollectionInput, AdminUpdateCollectionInput, ListCollectionsQuery } from './collection.dto.js';

export async function listPublic(req: Request, res: Response): Promise<void> {
  const query = ListCollectionsQuery.parse(req.query);
  const { collections, total } = await service.listPublicCollections(query.page, query.limit);
  sendSuccess(res, { collections }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function getPublicBySlug(req: Request, res: Response): Promise<void> {
  const collection = await service.getCollectionBySlug(req.params.slug as string);
  sendSuccess(res, collection);
}

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = ListCollectionsQuery.parse(req.query);
  const { collections, total } = await service.adminListCollections(actor, query.status, query.page, query.limit);
  sendSuccess(res, { collections }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const collection = await service.adminGetCollection(actor, objectId.parse(req.params.id));
  sendSuccess(res, { collection });
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminCreateCollectionInput.parse(req.body);
  const collection = await service.createCollection(actor, input);
  sendSuccess(res, { collection }, undefined, 201);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminUpdateCollectionInput.parse(req.body);
  const collection = await service.updateCollection(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { collection });
}

export async function adminDelete(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  await service.deleteCollection(actor, objectId.parse(req.params.id));
  sendSuccess(res, {});
}
