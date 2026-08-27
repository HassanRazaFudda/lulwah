import { slugify } from '@lulwah/utils';
import type { Page, PublicPage } from '@lulwah/contracts';
import { AppError, notFoundError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as repo from './page.repository.js';
import { toPageDto, toPublicPageDto } from './page.mapper.js';
import { sanitizeRichText } from './sanitize.js';
import { contentEvents } from './content.events.js';
import type { AdminCreatePageInput, AdminUpdatePageInput } from './page.dto.js';

function isDuplicateSlugError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

export async function adminListPages(actor: AuthenticatedUser, status: Page['status'] | undefined, page: number, limit: number): Promise<{ pages: Page[]; total: number }> {
  assertPermission(actor, 'content.read');
  const { pages, total } = await repo.listPages(status, page, limit);
  return { pages: pages.map(toPageDto), total };
}

export async function adminGetPage(actor: AuthenticatedUser, id: string): Promise<Page> {
  assertPermission(actor, 'content.read');
  const doc = await repo.findPageById(id);
  if (!doc) throw notFoundError('Page not found.');
  return toPageDto(doc);
}

export async function createPage(actor: AuthenticatedUser, input: AdminCreatePageInput): Promise<Page> {
  assertPermission(actor, 'content.write');
  const slug = input.slug ?? slugify(input.titleEn);
  try {
    const doc = await repo.createPage({
      ...input,
      slug,
      bodyEn: sanitizeRichText(input.bodyEn),
      bodyAr: sanitizeRichText(input.bodyAr),
    });
    if (doc.status === 'published') contentEvents.publish('page.published', { slug: doc.slug });
    return toPageDto(doc);
  } catch (err) {
    if (isDuplicateSlugError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A page with this slug already exists.', field: 'slug' });
    throw err;
  }
}

export async function updatePage(actor: AuthenticatedUser, id: string, input: AdminUpdatePageInput): Promise<Page> {
  assertPermission(actor, 'content.write');
  const existing = await repo.findPageById(id);
  if (!existing) throw notFoundError('Page not found.');

  try {
    const doc = await repo.updatePage(id, {
      ...input,
      ...(input.bodyEn !== undefined ? { bodyEn: sanitizeRichText(input.bodyEn) } : {}),
      ...(input.bodyAr !== undefined ? { bodyAr: sanitizeRichText(input.bodyAr) } : {}),
    });
    if (!doc) throw notFoundError('Page not found.');
    if (doc.status === 'published' && existing.status !== 'published') contentEvents.publish('page.published', { slug: doc.slug });
    return toPageDto(doc);
  } catch (err) {
    if (isDuplicateSlugError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A page with this slug already exists.', field: 'slug' });
    throw err;
  }
}

export async function deletePage(actor: AuthenticatedUser, id: string): Promise<void> {
  assertPermission(actor, 'content.write');
  const deleted = await repo.softDeletePage(id);
  if (!deleted) throw notFoundError('Page not found.');
}

/** `GET /content/pages/:slug` — a published page only; a draft or unknown
 *  slug both 404 identically, so a customer can't distinguish "doesn't
 *  exist" from "not published yet". */
export async function getPublicPageBySlug(slug: string): Promise<PublicPage> {
  const doc = await repo.findPageBySlug(slug);
  if (!doc) throw notFoundError('Page not found.');
  return toPublicPageDto(doc);
}
