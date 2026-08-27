import type { PartialWithUndefined } from '../../shared/types.js';
import { PageModel } from './page.model.js';
import type { PageDoc, PageHydratedDoc, PageSeoSubdoc } from './page.model.js';

/** The ONLY file allowed to touch `PageModel` (plan.md §5.4). `seo` is
 *  typed against what `page.dto.ts`'s Zod schema actually parses (every
 *  key independently optional/undefined), not the subdocument's always-
 *  present `| null` shape — see `product.repository.ts#LooseProductSeo`'s
 *  equivalent comment. */
export interface LoosePageSeo {
  titleEn?: string | undefined;
  titleAr?: string | undefined;
  descEn?: string | undefined;
  descAr?: string | undefined;
}

export type CreatePageInput = Pick<PageDoc, 'slug' | 'titleEn'> &
  Partial<Pick<PageDoc, 'titleAr' | 'bodyEn' | 'bodyAr' | 'status'>> &
  Partial<{ seo: LoosePageSeo }>;

export type UpdatePageInput = PartialWithUndefined<CreatePageInput>;

function toPageSeoSubdoc(seo: LoosePageSeo | undefined): PageSeoSubdoc | undefined {
  if (!seo) return undefined;
  return { titleEn: seo.titleEn ?? null, titleAr: seo.titleAr ?? null, descEn: seo.descEn ?? null, descAr: seo.descAr ?? null };
}

const NOT_DELETED = { deletedAt: null };

export async function createPage(input: CreatePageInput): Promise<PageHydratedDoc> {
  const { seo, ...rest } = input;
  // `Mongoose 9`'s `.create()` overload resolution can't express "an
  // optional key, normalized to a different shape when present" under
  // `exactOptionalPropertyTypes` — same cast `product.repository.ts#createProduct`
  // uses for the identical `seo` shape. The runtime value already matches
  // `PageDoc`'s schema exactly; this only papers over TS's overload
  // matching, not a runtime shape mismatch.
  const doc = { ...rest, ...(seo !== undefined ? { seo: toPageSeoSubdoc(seo) } : {}) } as unknown as Parameters<typeof PageModel.create>[0];
  return PageModel.create(doc);
}

export async function findPageBySlug(slug: string, opts: { includeUnpublished?: boolean } = {}): Promise<PageHydratedDoc | null> {
  const query: Record<string, unknown> = { slug, ...NOT_DELETED };
  if (!opts.includeUnpublished) query.status = 'published';
  return PageModel.findOne(query).exec();
}

export async function findPageById(id: string): Promise<PageHydratedDoc | null> {
  return PageModel.findOne({ _id: id, ...NOT_DELETED }).exec();
}

export async function listPages(status: PageDoc['status'] | undefined, page: number, limit: number): Promise<{ pages: PageHydratedDoc[]; total: number }> {
  const query = { ...NOT_DELETED, ...(status ? { status } : {}) };
  const [pages, total] = await Promise.all([
    PageModel.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    PageModel.countDocuments(query).exec(),
  ]);
  return { pages, total };
}

export async function updatePage(id: string, input: UpdatePageInput): Promise<PageHydratedDoc | null> {
  const { seo, ...rest } = input;
  // See `createPage`'s comment on this cast.
  const update = { ...rest, ...(seo !== undefined ? { seo: toPageSeoSubdoc(seo) } : {}) } as unknown as Parameters<typeof PageModel.findOneAndUpdate>[1];
  return PageModel.findOneAndUpdate({ _id: id, ...NOT_DELETED }, update, { returnDocument: 'after' }).exec();
}

export async function softDeletePage(id: string): Promise<boolean> {
  const result = await PageModel.updateOne({ _id: id, ...NOT_DELETED }, { deletedAt: new Date() }).exec();
  return result.modifiedCount > 0;
}
