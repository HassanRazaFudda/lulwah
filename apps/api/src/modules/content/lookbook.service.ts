import { slugify } from '@lulwah/utils';
import type { Lookbook, PublicLookbook } from '@lulwah/contracts';
import { AppError, notFoundError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as repo from './lookbook.repository.js';
import { toLookbookDto, toPublicLookbookDto } from './lookbook.mapper.js';
import { sanitizeRichText } from './sanitize.js';
import { contentEvents } from './content.events.js';
import type { AdminCreateLookbookInput, AdminUpdateLookbookInput } from './lookbook.dto.js';

function isDuplicateSlugError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

export async function adminListLookbooks(
  actor: AuthenticatedUser,
  status: Lookbook['status'] | undefined,
  page: number,
  limit: number,
): Promise<{ lookbooks: Lookbook[]; total: number }> {
  assertPermission(actor, 'content.read');
  const { lookbooks, total } = await repo.listLookbooks(status, page, limit);
  return { lookbooks: lookbooks.map(toLookbookDto), total };
}

export async function adminGetLookbook(actor: AuthenticatedUser, id: string): Promise<Lookbook> {
  assertPermission(actor, 'content.read');
  const doc = await repo.findLookbookById(id);
  if (!doc) throw notFoundError('Lookbook not found.');
  return toLookbookDto(doc);
}

export async function createLookbook(actor: AuthenticatedUser, input: AdminCreateLookbookInput): Promise<Lookbook> {
  assertPermission(actor, 'content.write');
  const slug = input.slug ?? slugify(input.titleEn);
  try {
    const doc = await repo.createLookbook({
      ...input,
      slug,
      bodyEn: sanitizeRichText(input.bodyEn),
      bodyAr: sanitizeRichText(input.bodyAr),
    });
    if (doc.status === 'published') contentEvents.publish('lookbook.published', { slug: doc.slug });
    return toLookbookDto(doc);
  } catch (err) {
    if (isDuplicateSlugError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A lookbook with this slug already exists.', field: 'slug' });
    throw err;
  }
}

export async function updateLookbook(actor: AuthenticatedUser, id: string, input: AdminUpdateLookbookInput): Promise<Lookbook> {
  assertPermission(actor, 'content.write');
  const existing = await repo.findLookbookById(id);
  if (!existing) throw notFoundError('Lookbook not found.');

  try {
    const doc = await repo.updateLookbook(id, {
      ...input,
      ...(input.bodyEn !== undefined ? { bodyEn: sanitizeRichText(input.bodyEn) } : {}),
      ...(input.bodyAr !== undefined ? { bodyAr: sanitizeRichText(input.bodyAr) } : {}),
    });
    if (!doc) throw notFoundError('Lookbook not found.');
    if (doc.status === 'published' && existing.status !== 'published') contentEvents.publish('lookbook.published', { slug: doc.slug });
    return toLookbookDto(doc);
  } catch (err) {
    if (isDuplicateSlugError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A lookbook with this slug already exists.', field: 'slug' });
    throw err;
  }
}

export async function deleteLookbook(actor: AuthenticatedUser, id: string): Promise<void> {
  assertPermission(actor, 'content.write');
  const deleted = await repo.softDeleteLookbook(id);
  if (!deleted) throw notFoundError('Lookbook not found.');
}

/** `GET /content/lookbooks` — published lookbooks only, in `sortOrder`. */
export async function listPublicLookbooks(): Promise<PublicLookbook[]> {
  const docs = await repo.listPublishedLookbooks();
  return docs.map(toPublicLookbookDto);
}

/** `GET /content/lookbooks/:slug` — a published lookbook only; a draft or
 *  unknown slug both 404 identically, matching `page.service.ts#getPublicPageBySlug`'s
 *  rule. */
export async function getPublicLookbookBySlug(slug: string): Promise<PublicLookbook> {
  const doc = await repo.findLookbookBySlug(slug);
  if (!doc) throw notFoundError('Lookbook not found.');
  return toPublicLookbookDto(doc);
}
