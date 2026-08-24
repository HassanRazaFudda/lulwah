import type { Size, VariantOptions } from '@lulwah/contracts';
import type { PartialWithUndefined } from '../../shared/types.js';
import { VariantModel } from './variant.model.js';
import type { VariantDoc, VariantHydratedDoc, VariantOptionsSubdoc } from './variant.model.js';

/** `VariantOptions` (contracts: each key independently optional/undefined)
 *  → `VariantOptionsSubdoc` (Mongoose: each key always present, `| null`)
 *  — same "normalize at the repository boundary" pattern as
 *  `media.mapper.ts#toMediaRefSubdoc`. */
function toVariantOptionsSubdoc(options: VariantOptions | undefined): VariantOptionsSubdoc | undefined {
  if (!options) return undefined;
  return { size: options.size ?? null, color: options.color ?? null, pieceCount: options.pieceCount ?? null };
}

/** The ONLY file allowed to touch `VariantModel` (plan.md §5.4). `options`
 *  is typed against `@lulwah/contracts`' `VariantOptions` (each key
 *  independently optional/undefined) rather than `VariantDoc`'s own
 *  Mongoose-native shape (each key always present, `| null`) — matches
 *  what `product.dto.ts`'s Zod schema actually parses; Mongoose applies
 *  each field's own schema default for whichever keys are missing. */
export type CreateVariantInput = Pick<VariantDoc, 'productId' | 'sku' | 'priceFils' | 'weightGrams'> &
  Partial<Pick<VariantDoc, 'barcode' | 'compareAtPriceFils' | 'costPriceFils' | 'mediaIds' | 'isActive' | 'sortOrder'>> &
  Partial<{ options: VariantOptions }>;

export type UpdateVariantInput = PartialWithUndefined<Omit<CreateVariantInput, 'productId'>>;

const NOT_DELETED = { deletedAt: null };

export async function createVariant(input: CreateVariantInput): Promise<VariantHydratedDoc> {
  const { options, ...rest } = input;
  // See `product.repository.ts#createProduct`'s comment on this class of cast.
  const doc = { ...rest, ...(options !== undefined ? { options: toVariantOptionsSubdoc(options) } : {}) } as unknown as Parameters<typeof VariantModel.create>[0];
  return VariantModel.create(doc);
}

export async function findVariantById(id: string): Promise<VariantHydratedDoc | null> {
  return VariantModel.findOne({ _id: id, ...NOT_DELETED }).exec();
}

export async function findVariantsByProductId(productId: string): Promise<VariantHydratedDoc[]> {
  return VariantModel.find({ productId, ...NOT_DELETED }).sort({ sortOrder: 1, createdAt: 1 }).exec();
}

/** Every active variant's price — the input to `product.service.ts`'s
 *  `priceRange` recompute (plan.md §7.5: "Denormalised for listing
 *  performance ... recomputed on write"). */
export async function findActiveVariantPrices(productId: string): Promise<{ priceFils: number }[]> {
  return VariantModel.find({ productId, isActive: true, ...NOT_DELETED }, { priceFils: 1 }).lean().exec();
}

/** Product ids that have at least one active variant matching a size —
 *  backs the public `?size=` facet filter without denormalising available
 *  sizes onto `Product` (plan.md's own size-as-a-variant-option model). */
export async function findProductIdsBySize(size: string): Promise<string[]> {
  const rows = await VariantModel.find({ 'options.size': size as Size, isActive: true, ...NOT_DELETED }, { productId: 1 })
    .lean()
    .exec();
  return Array.from(new Set(rows.map((row) => row.productId.toString())));
}

export async function updateVariant(id: string, input: UpdateVariantInput): Promise<VariantHydratedDoc | null> {
  const { options, ...rest } = input;
  // See `createVariant`'s comment on this cast.
  const update = { ...rest, ...(options !== undefined ? { options: toVariantOptionsSubdoc(options) } : {}) } as unknown as Parameters<typeof VariantModel.findOneAndUpdate>[1];
  return VariantModel.findOneAndUpdate({ _id: id, ...NOT_DELETED }, update, { returnDocument: 'after' }).exec();
}

export async function softDeleteVariant(id: string): Promise<VariantHydratedDoc | null> {
  return VariantModel.findOneAndUpdate({ _id: id, ...NOT_DELETED }, { deletedAt: new Date(), isActive: false }, { returnDocument: 'after' }).exec();
}

/** Non-deleted variants remaining for a product (regardless of `isActive`)
 *  — used after a delete to decide whether `Product.hasVariants` should
 *  flip back to `false`. */
export async function countVariantsForProduct(productId: string): Promise<number> {
  return VariantModel.countDocuments({ productId, ...NOT_DELETED }).exec();
}
