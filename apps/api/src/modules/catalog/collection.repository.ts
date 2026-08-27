import type { MediaRef } from '@lulwah/contracts';
import type { PartialWithUndefined } from '../../shared/types.js';
import { CollectionModel } from './collection.model.js';
import type { CollectionDoc, CollectionHydratedDoc } from './collection.model.js';
import { toMediaRefSubdoc } from './media.mapper.js';

/** The ONLY file allowed to touch `CollectionModel` (plan.md §5.4).
 *  `brandId`/`productIds`/`heroImage` are typed against the input (string
 *  ids / `MediaRef`) rather than `CollectionDoc`'s Mongoose-native shape —
 *  see `brand.repository.ts`'s equivalent comment. */
export type CreateCollectionInput = Pick<CollectionDoc, 'name' | 'slug' | 'type'> &
  Partial<
    Pick<
      CollectionDoc,
      'nameAr' | 'subtitle' | 'descriptionEn' | 'descriptionAr' | 'rules' | 'launchAt' | 'endAt' | 'isTeaserVisible' | 'status' | 'layout' | 'sortOrder' | 'isFeatured'
    >
  > &
  Partial<{ brandId: string | null; productIds: string[]; heroImage: MediaRef | null; heroImageMobile: MediaRef | null }>;

export type UpdateCollectionInput = PartialWithUndefined<CreateCollectionInput>;

const NOT_DELETED = { deletedAt: null };

export async function createCollection(input: CreateCollectionInput): Promise<CollectionHydratedDoc> {
  const { heroImage, heroImageMobile, ...rest } = input;
  return CollectionModel.create({
    ...rest,
    ...(heroImage !== undefined ? { heroImage: toMediaRefSubdoc(heroImage) } : {}),
    ...(heroImageMobile !== undefined ? { heroImageMobile: toMediaRefSubdoc(heroImageMobile) } : {}),
  });
}

export async function findCollectionBySlug(slug: string): Promise<CollectionHydratedDoc | null> {
  return CollectionModel.findOne({ slug, ...NOT_DELETED }).exec();
}

export async function findCollectionById(id: string): Promise<CollectionHydratedDoc | null> {
  return CollectionModel.findOne({ _id: id, ...NOT_DELETED }).exec();
}

export async function listCollections(
  filter: { status?: CollectionDoc['status'] },
  page: number,
  limit: number,
): Promise<{ collections: CollectionHydratedDoc[]; total: number }> {
  const query = { ...NOT_DELETED, ...(filter.status ? { status: filter.status } : {}) };
  const [collections, total] = await Promise.all([
    CollectionModel.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    CollectionModel.countDocuments(query).exec(),
  ]);
  return { collections, total };
}

export async function updateCollection(id: string, input: UpdateCollectionInput): Promise<CollectionHydratedDoc | null> {
  const { heroImage, heroImageMobile, ...rest } = input;
  return CollectionModel.findOneAndUpdate(
    { _id: id, ...NOT_DELETED },
    {
      ...rest,
      ...(heroImage !== undefined ? { heroImage: toMediaRefSubdoc(heroImage) } : {}),
      ...(heroImageMobile !== undefined ? { heroImageMobile: toMediaRefSubdoc(heroImageMobile) } : {}),
    },
    { returnDocument: 'after' },
  ).exec();
}

export async function softDeleteCollection(id: string): Promise<boolean> {
  const result = await CollectionModel.updateOne({ _id: id, ...NOT_DELETED }, { deletedAt: new Date(), status: 'ended' }).exec();
  return result.modifiedCount > 0;
}
