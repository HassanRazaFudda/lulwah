import type { MediaRef } from '@lulwah/contracts';
import type { PartialWithUndefined } from '../../shared/types.js';
import { BannerModel } from './banner.model.js';
import type { BannerDoc, BannerHydratedDoc } from './banner.model.js';
import { toMediaRefSubdoc } from './media-ref.mapper.js';

/** The ONLY file allowed to touch `BannerModel` (plan.md §5.4). */

export type CreateBannerInput = Pick<BannerDoc, 'placement'> &
  Partial<Pick<BannerDoc, 'link' | 'textEn' | 'textAr' | 'isActive' | 'startsAt' | 'endsAt' | 'sortOrder'>> &
  Partial<{ mediaDesktop: MediaRef | null; mediaMobile: MediaRef | null }>;

export type UpdateBannerInput = PartialWithUndefined<CreateBannerInput>;

const NOT_DELETED = { deletedAt: null };

export async function createBanner(input: CreateBannerInput): Promise<BannerHydratedDoc> {
  const { mediaDesktop, mediaMobile, ...rest } = input;
  return BannerModel.create({
    ...rest,
    ...(mediaDesktop !== undefined ? { mediaDesktop: toMediaRefSubdoc(mediaDesktop) } : {}),
    ...(mediaMobile !== undefined ? { mediaMobile: toMediaRefSubdoc(mediaMobile) } : {}),
  });
}

export async function findBannerById(id: string): Promise<BannerHydratedDoc | null> {
  return BannerModel.findOne({ _id: id, ...NOT_DELETED }).exec();
}

export async function listBanners(placement?: BannerDoc['placement']): Promise<BannerHydratedDoc[]> {
  const query = { ...NOT_DELETED, ...(placement ? { placement } : {}) };
  return BannerModel.find(query).sort({ sortOrder: 1, createdAt: -1 }).exec();
}

/** `GET /content/banners` — only active, in-window banners for the
 *  requested placement. */
export async function listPublishedBanners(placement: BannerDoc['placement'] | undefined, now: Date): Promise<BannerHydratedDoc[]> {
  return BannerModel.find({
    ...NOT_DELETED,
    ...(placement ? { placement } : {}),
    isActive: true,
    $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }],
  })
    .sort({ sortOrder: 1 })
    .exec();
}

export async function updateBanner(id: string, input: UpdateBannerInput): Promise<BannerHydratedDoc | null> {
  const { mediaDesktop, mediaMobile, ...rest } = input;
  return BannerModel.findOneAndUpdate(
    { _id: id, ...NOT_DELETED },
    {
      ...rest,
      ...(mediaDesktop !== undefined ? { mediaDesktop: toMediaRefSubdoc(mediaDesktop) } : {}),
      ...(mediaMobile !== undefined ? { mediaMobile: toMediaRefSubdoc(mediaMobile) } : {}),
    },
    { returnDocument: 'after' },
  ).exec();
}

export async function softDeleteBanner(id: string): Promise<boolean> {
  const result = await BannerModel.updateOne({ _id: id, ...NOT_DELETED }, { deletedAt: new Date() }).exec();
  return result.modifiedCount > 0;
}
