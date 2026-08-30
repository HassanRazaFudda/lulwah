import { slugify } from '@lulwah/utils';
import type { JournalPost, PublicJournalPost } from '@lulwah/contracts';
import { AppError, notFoundError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as repo from './journal.repository.js';
import { toJournalPostDto, toPublicJournalPostDto } from './journal.mapper.js';
import { sanitizeRichText } from './sanitize.js';
import { contentEvents } from './content.events.js';
import type { AdminCreateJournalPostInput, AdminUpdateJournalPostInput } from './journal.dto.js';

function isDuplicateSlugError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

/** `publishedAt` defaults to "now" the moment a post's `status` first
 *  becomes `'published'` without an explicit `publishedAt` on the same
 *  write — an admin who wants to schedule/backdate a post passes a real
 *  date and this leaves it alone either way. A documented judgment call:
 *  no spec text pins this behavior down beyond "nullable until actually
 *  published". */
function resolvePublishedAtOnCreate(status: JournalPost['status'], publishedAt: Date | null): Date | null {
  if (status === 'published' && publishedAt === null) return new Date();
  return publishedAt;
}

export async function adminListJournalPosts(
  actor: AuthenticatedUser,
  status: JournalPost['status'] | undefined,
  page: number,
  limit: number,
): Promise<{ posts: JournalPost[]; total: number }> {
  assertPermission(actor, 'content.read');
  const { posts, total } = await repo.listJournalPosts(status, page, limit);
  return { posts: posts.map(toJournalPostDto), total };
}

export async function adminGetJournalPost(actor: AuthenticatedUser, id: string): Promise<JournalPost> {
  assertPermission(actor, 'content.read');
  const doc = await repo.findJournalPostById(id);
  if (!doc) throw notFoundError('Journal post not found.');
  return toJournalPostDto(doc);
}

export async function createJournalPost(actor: AuthenticatedUser, input: AdminCreateJournalPostInput): Promise<JournalPost> {
  assertPermission(actor, 'content.write');
  const slug = input.slug ?? slugify(input.titleEn);
  const publishedAt = resolvePublishedAtOnCreate(input.status, input.publishedAt);
  try {
    const doc = await repo.createJournalPost({
      ...input,
      slug,
      publishedAt,
      bodyEn: sanitizeRichText(input.bodyEn),
      bodyAr: sanitizeRichText(input.bodyAr),
    });
    if (doc.status === 'published') contentEvents.publish('journal.published', { slug: doc.slug });
    return toJournalPostDto(doc);
  } catch (err) {
    if (isDuplicateSlugError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A journal post with this slug already exists.', field: 'slug' });
    throw err;
  }
}

export async function updateJournalPost(actor: AuthenticatedUser, id: string, input: AdminUpdateJournalPostInput): Promise<JournalPost> {
  assertPermission(actor, 'content.write');
  const existing = await repo.findJournalPostById(id);
  if (!existing) throw notFoundError('Journal post not found.');

  const nextStatus = input.status ?? existing.status;
  let publishedAt = input.publishedAt;
  if (publishedAt === undefined && nextStatus === 'published' && existing.publishedAt === null) {
    publishedAt = new Date();
  }

  try {
    const doc = await repo.updateJournalPost(id, {
      ...input,
      ...(publishedAt !== undefined ? { publishedAt } : {}),
      ...(input.bodyEn !== undefined ? { bodyEn: sanitizeRichText(input.bodyEn) } : {}),
      ...(input.bodyAr !== undefined ? { bodyAr: sanitizeRichText(input.bodyAr) } : {}),
    });
    if (!doc) throw notFoundError('Journal post not found.');
    if (doc.status === 'published' && existing.status !== 'published') contentEvents.publish('journal.published', { slug: doc.slug });
    return toJournalPostDto(doc);
  } catch (err) {
    if (isDuplicateSlugError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A journal post with this slug already exists.', field: 'slug' });
    throw err;
  }
}

export async function deleteJournalPost(actor: AuthenticatedUser, id: string): Promise<void> {
  assertPermission(actor, 'content.write');
  const deleted = await repo.softDeleteJournalPost(id);
  if (!deleted) throw notFoundError('Journal post not found.');
}

/** `GET /content/journal` — published posts, newest first, paginated; an
 *  optional `slugs` filter (see `journal.dto.ts#ListJournalPostsQuery`)
 *  resolves `journal_teaser`'s `postSlugs` to real posts, in request order. */
export async function listPublicJournalPosts(slugs: readonly string[] | undefined, page: number, limit: number): Promise<{ posts: PublicJournalPost[]; total: number }> {
  if (slugs !== undefined) {
    const docs = await repo.findPublishedJournalPostsBySlugs(slugs);
    return { posts: docs.map(toPublicJournalPostDto), total: docs.length };
  }
  const { posts, total } = await repo.listPublishedJournalPosts(page, limit);
  return { posts: posts.map(toPublicJournalPostDto), total };
}

/** `GET /content/journal/:slug` — a published post only; a draft or unknown
 *  slug both 404 identically, matching `page.service.ts#getPublicPageBySlug`'s
 *  rule. */
export async function getPublicJournalPostBySlug(slug: string): Promise<PublicJournalPost> {
  const doc = await repo.findJournalPostBySlug(slug);
  if (!doc) throw notFoundError('Journal post not found.');
  return toPublicJournalPostDto(doc);
}
