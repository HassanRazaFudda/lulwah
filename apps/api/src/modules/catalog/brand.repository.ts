import type { MediaRef } from '@lulwah/contracts';
import type { PartialWithUndefined } from '../../shared/types.js';
import { BrandModel } from './brand.model.js';
import type { BrandDoc, BrandHydratedDoc } from './brand.model.js';
import { toMediaRefSubdoc } from './media.mapper.js';

/**
 * The ONLY file allowed to touch `BrandModel` (plan.md §5.4). No business
 * rules — just reads/writes. `logo`/`coverImage` are typed against
 * `@lulwah/contracts`' `MediaRef` (optional width/height) rather than
 * `BrandDoc`'s own Mongoose-native shape (nullable width/height) — this is
 * the input side, matching what `brand.dto.ts`'s Zod schema actually
 * parses; Mongoose casts either shape identically at runtime.
 */
export type CreateBrandInput = Pick<BrandDoc, 'name' | 'slug' | 'countryOfOrigin'> &
  Partial<Pick<BrandDoc, 'nameAr' | 'description' | 'descriptionAr' | 'sortOrder' | 'isFeatured' | 'isActive'>> &
  Partial<{ logo: MediaRef | null; coverImage: MediaRef | null }>;

export type UpdateBrandInput = PartialWithUndefined<CreateBrandInput>;

const NOT_DELETED = { deletedAt: null };

export async function createBrand(input: CreateBrandInput): Promise<BrandHydratedDoc> {
  // Destructured out (not just spread-then-overridden): TS unions a
  // property's type across every spread source that could supply it, so
  // `...input, ...( {logo: normalized} )` would still type `logo` as the
  // original loose shape too. Removing it from `rest` first means the
  // normalized value is the only source.
  const { logo, coverImage, ...rest } = input;
  return BrandModel.create({
    ...rest,
    ...(logo !== undefined ? { logo: toMediaRefSubdoc(logo) } : {}),
    ...(coverImage !== undefined ? { coverImage: toMediaRefSubdoc(coverImage) } : {}),
  });
}

export async function findBrandBySlug(slug: string): Promise<BrandHydratedDoc | null> {
  return BrandModel.findOne({ slug, ...NOT_DELETED }).exec();
}

export async function findBrandById(id: string): Promise<BrandHydratedDoc | null> {
  return BrandModel.findOne({ _id: id, ...NOT_DELETED }).exec();
}

export async function findBrandsByIds(ids: readonly string[]): Promise<BrandHydratedDoc[]> {
  return BrandModel.find({ _id: { $in: ids }, ...NOT_DELETED }).exec();
}

export async function listActiveBrands(): Promise<BrandHydratedDoc[]> {
  return BrandModel.find({ isActive: true, ...NOT_DELETED }).sort({ sortOrder: 1, name: 1 }).exec();
}

export async function listAllBrands(page: number, limit: number): Promise<{ brands: BrandHydratedDoc[]; total: number }> {
  const filter = NOT_DELETED;
  const [brands, total] = await Promise.all([
    BrandModel.find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    BrandModel.countDocuments(filter).exec(),
  ]);
  return { brands, total };
}

export async function updateBrand(id: string, input: UpdateBrandInput): Promise<BrandHydratedDoc | null> {
  const { logo, coverImage, ...rest } = input;
  return BrandModel.findOneAndUpdate(
    { _id: id, ...NOT_DELETED },
    { ...rest, ...(logo !== undefined ? { logo: toMediaRefSubdoc(logo) } : {}), ...(coverImage !== undefined ? { coverImage: toMediaRefSubdoc(coverImage) } : {}) },
    { returnDocument: 'after' },
  ).exec();
}

export async function softDeleteBrand(id: string): Promise<boolean> {
  const result = await BrandModel.updateOne({ _id: id, ...NOT_DELETED }, { deletedAt: new Date(), isActive: false }).exec();
  return result.modifiedCount > 0;
}
