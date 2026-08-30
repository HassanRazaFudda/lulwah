import type { MediaRef } from '@lulwah/contracts';
import type { PartialWithUndefined } from '../../shared/types.js';
import { LookbookModel } from './lookbook.model.js';
import type { LookbookDoc, LookbookHydratedDoc, LookbookSeoSubdoc } from './lookbook.model.js';
import { toMediaRefSubdoc } from './media-ref.mapper.js';

/** The ONLY file allowed to touch `LookbookModel` (plan.md §5.4). `seo` is
 *  typed against what `lookbook.dto.ts`'s Zod schema actually parses (every
 *  key independently optional/undefined), not the subdocument's always-
 *  present `| null` shape — see `page.repository.ts#LoosePageSeo`'s
 *  equivalent comment. */
export interface LooseLookbookSeo {
  titleEn?: string | undefined;
  titleAr?: string | undefined;
  descEn?: string | undefined;
  descAr?: string | undefined;
}

export type CreateLookbookInput = Pick<LookbookDoc, 'slug' | 'titleEn'> &
  Partial<Pick<LookbookDoc, 'titleAr' | 'bodyEn' | 'bodyAr' | 'status' | 'sortOrder'>> &
  Partial<{
    heroMedia: MediaRef | null;
    heroMediaMobile: MediaRef | null;
    gallery: MediaRef[];
    collectionId: string | null;
    seo: LooseLookbookSeo;
  }>;

export type UpdateLookbookInput = PartialWithUndefined<CreateLookbookInput>;

function toLookbookSeoSubdoc(seo: LooseLookbookSeo | undefined): LookbookSeoSubdoc | undefined {
  if (!seo) return undefined;
  return { titleEn: seo.titleEn ?? null, titleAr: seo.titleAr ?? null, descEn: seo.descEn ?? null, descAr: seo.descAr ?? null };
}

function toGallerySubdoc(gallery: MediaRef[] | undefined) {
  if (gallery === undefined) return undefined;
  return gallery.map((item) => toMediaRefSubdoc(item));
}

const NOT_DELETED = { deletedAt: null };

export async function createLookbook(input: CreateLookbookInput): Promise<LookbookHydratedDoc> {
  const { seo, heroMedia, heroMediaMobile, gallery, ...rest } = input;
  // Same overload-resolution cast `page.repository.ts#createPage` documents
  // — `exactOptionalPropertyTypes` can't express "an optional key,
  // normalized to a different shape when present" through Mongoose 9's
  // `.create()` overloads. The runtime value already matches `LookbookDoc`'s
  // schema exactly; this only papers over TS's overload matching.
  const doc = {
    ...rest,
    ...(seo !== undefined ? { seo: toLookbookSeoSubdoc(seo) } : {}),
    ...(heroMedia !== undefined ? { heroMedia: toMediaRefSubdoc(heroMedia) } : {}),
    ...(heroMediaMobile !== undefined ? { heroMediaMobile: toMediaRefSubdoc(heroMediaMobile) } : {}),
    ...(gallery !== undefined ? { gallery: toGallerySubdoc(gallery) } : {}),
  } as unknown as Parameters<typeof LookbookModel.create>[0];
  return LookbookModel.create(doc);
}

export async function findLookbookBySlug(slug: string, opts: { includeUnpublished?: boolean } = {}): Promise<LookbookHydratedDoc | null> {
  const query: Record<string, unknown> = { slug, ...NOT_DELETED };
  if (!opts.includeUnpublished) query.status = 'published';
  return LookbookModel.findOne(query).exec();
}

export async function findLookbookById(id: string): Promise<LookbookHydratedDoc | null> {
  return LookbookModel.findOne({ _id: id, ...NOT_DELETED }).exec();
}

export async function listLookbooks(status: LookbookDoc['status'] | undefined, page: number, limit: number): Promise<{ lookbooks: LookbookHydratedDoc[]; total: number }> {
  const query = { ...NOT_DELETED, ...(status ? { status } : {}) };
  const [lookbooks, total] = await Promise.all([
    LookbookModel.find(query)
      .sort({ sortOrder: 1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    LookbookModel.countDocuments(query).exec(),
  ]);
  return { lookbooks, total };
}

/** `GET /content/lookbooks` — published lookbooks only, in `sortOrder`. */
export async function listPublishedLookbooks(): Promise<LookbookHydratedDoc[]> {
  return LookbookModel.find({ ...NOT_DELETED, status: 'published' })
    .sort({ sortOrder: 1 })
    .exec();
}

export async function updateLookbook(id: string, input: UpdateLookbookInput): Promise<LookbookHydratedDoc | null> {
  const { seo, heroMedia, heroMediaMobile, gallery, ...rest } = input;
  // See `createLookbook`'s comment on this cast.
  const update = {
    ...rest,
    ...(seo !== undefined ? { seo: toLookbookSeoSubdoc(seo) } : {}),
    ...(heroMedia !== undefined ? { heroMedia: toMediaRefSubdoc(heroMedia) } : {}),
    ...(heroMediaMobile !== undefined ? { heroMediaMobile: toMediaRefSubdoc(heroMediaMobile) } : {}),
    ...(gallery !== undefined ? { gallery: toGallerySubdoc(gallery) } : {}),
  } as unknown as Parameters<typeof LookbookModel.findOneAndUpdate>[1];
  return LookbookModel.findOneAndUpdate({ _id: id, ...NOT_DELETED }, update, { returnDocument: 'after' }).exec();
}

export async function softDeleteLookbook(id: string): Promise<boolean> {
  const result = await LookbookModel.updateOne({ _id: id, ...NOT_DELETED }, { deletedAt: new Date() }).exec();
  return result.modifiedCount > 0;
}
