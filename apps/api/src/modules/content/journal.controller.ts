import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { sendSuccess } from '../../shared/response.js';
import { requireAuthedUser } from './content.controller-utils.js';
import * as service from './journal.service.js';
import { AdminCreateJournalPostInput, AdminListJournalPostsQuery, AdminUpdateJournalPostInput, ListJournalPostsQuery } from './journal.dto.js';

export async function adminList(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const query = AdminListJournalPostsQuery.parse(req.query);
  const { posts, total } = await service.adminListJournalPosts(actor, query.status, query.page, query.limit);
  sendSuccess(res, { posts }, { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total });
}

export async function adminGet(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const post = await service.adminGetJournalPost(actor, objectId.parse(req.params.id));
  sendSuccess(res, { post });
}

export async function adminCreate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminCreateJournalPostInput.parse(req.body);
  const post = await service.createJournalPost(actor, input);
  sendSuccess(res, { post }, undefined, 201);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const input = AdminUpdateJournalPostInput.parse(req.body);
  const post = await service.updateJournalPost(actor, objectId.parse(req.params.id), input);
  sendSuccess(res, { post });
}

export async function adminDelete(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  await service.deleteJournalPost(actor, objectId.parse(req.params.id));
  sendSuccess(res, {});
}

/** `slugs=a,b,c` → `['a', 'b', 'c']`, trimmed, empty segments dropped;
 *  `undefined` when the query param itself is absent so
 *  `journal.service.ts#listPublicJournalPosts` can tell "no filter" apart
 *  from "filter matched nothing". */
function parseSlugs(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const slugs = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return slugs.length > 0 ? slugs : undefined;
}

export async function listPublic(req: Request, res: Response): Promise<void> {
  const query = ListJournalPostsQuery.parse(req.query);
  const slugs = parseSlugs(query.slugs);
  const { posts, total } = await service.listPublicJournalPosts(slugs, query.page, query.limit);
  // A `slugs` lookup isn't a paginated listing — no `meta` for it, same as
  // any other single-batch resolution in this codebase.
  sendSuccess(res, { posts }, slugs === undefined ? { page: query.page, limit: query.limit, total, hasMore: query.page * query.limit < total } : undefined);
}

export async function getPublicBySlug(req: Request, res: Response): Promise<void> {
  const post = await service.getPublicJournalPostBySlug(req.params.slug as string);
  sendSuccess(res, { post });
}
