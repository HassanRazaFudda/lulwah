import type { MediaRef } from '@lulwah/contracts';
import type { PartialWithUndefined } from '../../shared/types.js';
import { JournalPostModel } from './journal.model.js';
import type { JournalPostDoc, JournalPostHydratedDoc, JournalPostSeoSubdoc } from './journal.model.js';
import { toMediaRefSubdoc } from './media-ref.mapper.js';

/** The ONLY file allowed to touch `JournalPostModel` (plan.md §5.4). `seo`
 *  is typed against what `journal.dto.ts`'s Zod schema actually parses,
 *  same `LoosePageSeo` pattern `page.repository.ts` documents. */
export interface LooseJournalPostSeo {
  titleEn?: string | undefined;
  titleAr?: string | undefined;
  descEn?: string | undefined;
  descAr?: string | undefined;
}

export type CreateJournalPostInput = Pick<JournalPostDoc, 'slug' | 'titleEn'> &
  Partial<Pick<JournalPostDoc, 'titleAr' | 'excerptEn' | 'excerptAr' | 'bodyEn' | 'bodyAr' | 'publishedAt' | 'status'>> &
  Partial<{ coverMedia: MediaRef | null; seo: LooseJournalPostSeo }>;

export type UpdateJournalPostInput = PartialWithUndefined<CreateJournalPostInput>;

function toJournalPostSeoSubdoc(seo: LooseJournalPostSeo | undefined): JournalPostSeoSubdoc | undefined {
  if (!seo) return undefined;
  return { titleEn: seo.titleEn ?? null, titleAr: seo.titleAr ?? null, descEn: seo.descEn ?? null, descAr: seo.descAr ?? null };
}

const NOT_DELETED = { deletedAt: null };

export async function createJournalPost(input: CreateJournalPostInput): Promise<JournalPostHydratedDoc> {
  const { seo, coverMedia, ...rest } = input;
  // Same overload-resolution cast `page.repository.ts#createPage` documents.
  const doc = {
    ...rest,
    ...(seo !== undefined ? { seo: toJournalPostSeoSubdoc(seo) } : {}),
    ...(coverMedia !== undefined ? { coverMedia: toMediaRefSubdoc(coverMedia) } : {}),
  } as unknown as Parameters<typeof JournalPostModel.create>[0];
  return JournalPostModel.create(doc);
}

export async function findJournalPostBySlug(slug: string, opts: { includeUnpublished?: boolean } = {}): Promise<JournalPostHydratedDoc | null> {
  const query: Record<string, unknown> = { slug, ...NOT_DELETED };
  if (!opts.includeUnpublished) query.status = 'published';
  return JournalPostModel.findOne(query).exec();
}

export async function findJournalPostById(id: string): Promise<JournalPostHydratedDoc | null> {
  return JournalPostModel.findOne({ _id: id, ...NOT_DELETED }).exec();
}

export async function listJournalPosts(status: JournalPostDoc['status'] | undefined, page: number, limit: number): Promise<{ posts: JournalPostHydratedDoc[]; total: number }> {
  const query = { ...NOT_DELETED, ...(status ? { status } : {}) };
  const [posts, total] = await Promise.all([
    JournalPostModel.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    JournalPostModel.countDocuments(query).exec(),
  ]);
  return { posts, total };
}

/** `GET /content/journal` — published posts, newest-first by `publishedAt`,
 *  paginated. */
export async function listPublishedJournalPosts(page: number, limit: number): Promise<{ posts: JournalPostHydratedDoc[]; total: number }> {
  const query = { ...NOT_DELETED, status: 'published' as const };
  const [posts, total] = await Promise.all([
    JournalPostModel.find(query)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    JournalPostModel.countDocuments(query).exec(),
  ]);
  return { posts, total };
}

/** The `journal_teaser` postSlugs→post resolution: published posts only,
 *  returned in the same order the slugs were requested (not query/insertion
 *  order), silently dropping any slug that doesn't match a published post. */
export async function findPublishedJournalPostsBySlugs(slugs: readonly string[]): Promise<JournalPostHydratedDoc[]> {
  if (slugs.length === 0) return [];
  const docs = await JournalPostModel.find({ ...NOT_DELETED, status: 'published', slug: { $in: slugs as string[] } }).exec();
  const bySlug = new Map(docs.map((doc) => [doc.slug, doc]));
  return slugs.map((slug) => bySlug.get(slug)).filter((doc): doc is JournalPostHydratedDoc => doc !== undefined);
}

export async function updateJournalPost(id: string, input: UpdateJournalPostInput): Promise<JournalPostHydratedDoc | null> {
  const { seo, coverMedia, ...rest } = input;
  // See `createJournalPost`'s comment on this cast.
  const update = {
    ...rest,
    ...(seo !== undefined ? { seo: toJournalPostSeoSubdoc(seo) } : {}),
    ...(coverMedia !== undefined ? { coverMedia: toMediaRefSubdoc(coverMedia) } : {}),
  } as unknown as Parameters<typeof JournalPostModel.findOneAndUpdate>[1];
  return JournalPostModel.findOneAndUpdate({ _id: id, ...NOT_DELETED }, update, { returnDocument: 'after' }).exec();
}

export async function softDeleteJournalPost(id: string): Promise<boolean> {
  const result = await JournalPostModel.updateOne({ _id: id, ...NOT_DELETED }, { deletedAt: new Date() }).exec();
  return result.modifiedCount > 0;
}
