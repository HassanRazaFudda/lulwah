import { Types, type QueryFilter, type SortOrder } from 'mongoose';
import type { PartialWithUndefined } from '../../shared/types.js';
import { ProductModel } from './product.model.js';
import type { ProductDoc, ProductHydratedDoc } from './product.model.js';

/**
 * The ONLY file allowed to touch `ProductModel` (plan.md §5.4). No business
 * rules — `product.service.ts` decides what a filter/sort/price recompute
 * means; this file only executes the query it's told to.
 *
 * `brandId`/`primaryCategoryId`/`categoryIds`/`collectionIds` are typed as
 * plain id strings (what `product.dto.ts`'s Zod schema actually parses),
 * not `ProductDoc`'s Mongoose-native `Types.ObjectId` — see
 * `brand.repository.ts`'s equivalent comment for why.
 */
/** A loose mirror of `ProductSeoSubdoc`, matching what `product.dto.ts`'s
 *  `ProductSeo.partial()` Zod schema actually parses (every key
 *  independently optional/undefined) rather than the Mongoose subdocument's
 *  always-present `| null` fields. */
export interface LooseProductSeo {
  titleEn?: string | undefined;
  titleAr?: string | undefined;
  descEn?: string | undefined;
  descAr?: string | undefined;
  canonical?: string | undefined;
  noindex?: boolean | undefined;
}

export type CreateProductInput = Pick<
  ProductDoc,
  'title' | 'slug' | 'articleCode' | 'stitchingType' | 'fabric' | 'season' | 'colorName' | 'colorFamily' | 'colorHex' | 'basePriceFils' | 'priceRange' | 'effectivePriceFils'
> & { brandId: string; primaryCategoryId: string } & Partial<
    Omit<ProductDoc, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'brandId' | 'primaryCategoryId' | 'categoryIds' | 'collectionIds' | 'seo'>
  > &
  Partial<{ categoryIds: string[]; collectionIds: string[]; seo: LooseProductSeo }>;

export type UpdateProductInput = PartialWithUndefined<Omit<CreateProductInput, 'slug'>> & { slug?: string | undefined };

/** `LooseProductSeo` → `ProductSeoSubdoc` — same "normalize at the
 *  repository boundary" pattern as `media.mapper.ts#toMediaRefSubdoc`. */
function toProductSeoSubdoc(seo: LooseProductSeo | undefined): ProductDoc['seo'] | undefined {
  if (!seo) return undefined;
  return {
    titleEn: seo.titleEn ?? null,
    titleAr: seo.titleAr ?? null,
    descEn: seo.descEn ?? null,
    descAr: seo.descAr ?? null,
    canonical: seo.canonical ?? null,
    noindex: seo.noindex ?? false,
  };
}

const NOT_DELETED = { deletedAt: null };

export interface ProductListFilter {
  status?: ProductDoc['status'];
  categoryId?: string;
  brandId?: string;
  collectionId?: string;
  stitchingType?: string;
  fabric?: string;
  work?: string;
  occasion?: string;
  colorFamily?: string;
  productIdsIn?: readonly string[];
  minPriceFils?: number;
  maxPriceFils?: number;
  inStock?: boolean;
  onSale?: boolean;
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'bestselling' | 'discount';

const SORT_SPECS: Record<ProductSort, Record<string, SortOrder>> = {
  newest: { createdAt: -1 },
  price_asc: { effectivePriceFils: 1 },
  price_desc: { effectivePriceFils: -1 },
  bestselling: { soldCount: -1, createdAt: -1 },
  discount: { discountPercent: -1 },
};

function buildFilter(filter: ProductListFilter): QueryFilter<ProductDoc> {
  // No implicit status default here — callers decide: `product.service.ts`'s
  // public `listProducts` always passes `status: 'active'` explicitly;
  // `adminListProducts` omits it entirely when the admin wants every status.
  const query: QueryFilter<ProductDoc> = { ...NOT_DELETED };
  if (filter.status) query.status = filter.status;
  if (filter.categoryId) query.categoryIds = new Types.ObjectId(filter.categoryId);
  if (filter.brandId) query.brandId = new Types.ObjectId(filter.brandId);
  if (filter.collectionId) query.collectionIds = new Types.ObjectId(filter.collectionId);
  if (filter.stitchingType) query.stitchingType = filter.stitchingType as ProductDoc['stitchingType'];
  if (filter.fabric) query.fabric = filter.fabric as ProductDoc['fabric'];
  if (filter.work) query.work = filter.work as unknown as ProductDoc['work'][number];
  if (filter.occasion) query.occasion = filter.occasion as unknown as ProductDoc['occasion'][number];
  if (filter.colorFamily) query.colorFamily = filter.colorFamily as ProductDoc['colorFamily'];
  if (filter.productIdsIn) query._id = { $in: filter.productIdsIn.map((id) => new Types.ObjectId(id)) };
  if (filter.inStock !== undefined) query.inStock = filter.inStock;
  if (filter.onSale) query.discountPercent = { $gt: 0 };
  if (filter.minPriceFils !== undefined || filter.maxPriceFils !== undefined) {
    query.effectivePriceFils = {
      ...(filter.minPriceFils !== undefined ? { $gte: filter.minPriceFils } : {}),
      ...(filter.maxPriceFils !== undefined ? { $lte: filter.maxPriceFils } : {}),
    };
  }
  return query;
}

export async function listProducts(
  filter: ProductListFilter,
  sort: ProductSort,
  page: number,
  limit: number,
): Promise<{ products: ProductHydratedDoc[]; total: number }> {
  const query = buildFilter(filter);
  const [products, total] = await Promise.all([
    ProductModel.find(query)
      .sort(SORT_SPECS[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    ProductModel.countDocuments(query).exec(),
  ]);
  return { products, total };
}

export async function createProduct(input: CreateProductInput): Promise<ProductHydratedDoc> {
  const { seo, ...rest } = input;
  // `Mongoose 9`'s `.create()` overload resolution can't express "an
  // optional key, normalized to a different shape when present" under
  // `exactOptionalPropertyTypes` — the runtime value is already the exact
  // `ProductSeoSubdoc` shape the schema expects (via `toProductSeoSubdoc`
  // above), this cast only papers over TS's overload-matching, not a
  // runtime shape mismatch.
  const doc = { ...rest, ...(seo !== undefined ? { seo: toProductSeoSubdoc(seo) } : {}) } as unknown as Parameters<typeof ProductModel.create>[0];
  return ProductModel.create(doc);
}

export async function findProductBySlug(slug: string, opts: { includeInactive?: boolean } = {}): Promise<ProductHydratedDoc | null> {
  const query: QueryFilter<ProductDoc> = { slug, ...NOT_DELETED };
  if (!opts.includeInactive) query.status = 'active';
  return ProductModel.findOne(query).exec();
}

export async function findProductById(id: string): Promise<ProductHydratedDoc | null> {
  return ProductModel.findOne({ _id: id, ...NOT_DELETED }).exec();
}

export async function findProductsByIds(ids: readonly string[]): Promise<ProductHydratedDoc[]> {
  return ProductModel.find({ _id: { $in: ids }, ...NOT_DELETED }).exec();
}

export async function findRelatedProducts(product: ProductHydratedDoc, limit: number): Promise<ProductHydratedDoc[]> {
  return ProductModel.find({
    _id: { $ne: product._id },
    status: 'active',
    ...NOT_DELETED,
    $or: [{ categoryIds: { $in: product.categoryIds } }, { brandId: product.brandId }],
  })
    .sort({ soldCount: -1, createdAt: -1 })
    .limit(limit)
    .exec();
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<ProductHydratedDoc | null> {
  const { seo, ...rest } = input;
  // See `createProduct`'s comment on this cast.
  const update = { ...rest, ...(seo !== undefined ? { seo: toProductSeoSubdoc(seo) } : {}) } as unknown as Parameters<typeof ProductModel.findOneAndUpdate>[1];
  return ProductModel.findOneAndUpdate({ _id: id, ...NOT_DELETED }, update, { returnDocument: 'after' }).exec();
}

export async function softDeleteProduct(id: string): Promise<boolean> {
  const result = await ProductModel.updateOne({ _id: id, ...NOT_DELETED }, { deletedAt: new Date(), status: 'archived' }).exec();
  return result.modifiedCount > 0;
}

/**
 * Targeted, atomic stock propagation from `inventory` (plan.md brief: "keep
 * this cheap — a targeted update, not a full product recompute on every
 * stock change"). An aggregation-pipeline update so `totalStock` and the
 * derived `inStock` flag are recomputed from the new value in one round
 * trip, never a stale read-then-write.
 */
export async function applyStockDelta(productId: string, deltaTotalStock: number): Promise<void> {
  // Mongoose 9 requires `updatePipeline: true` explicitly before it will
  // accept an aggregation-pipeline array as the update document (it
  // otherwise throws, mistaking the array for the legacy multi-update
  // shape) — plain `.set(...)` doesn't cover this option, hence the raw
  // options object.
  await ProductModel.updateOne(
    { _id: productId },
    [{ $set: { totalStock: { $max: [0, { $add: ['$totalStock', deltaTotalStock] }] } } }, { $set: { inStock: { $gt: ['$totalStock', 0] } } }],
    { updatePipeline: true },
  ).exec();
}

export async function updatePriceRange(productId: string, priceRange: { minFils: number; maxFils: number }): Promise<void> {
  await ProductModel.updateOne({ _id: productId }, { priceRange }).exec();
}

/** plan.md §7.14: "If Meilisearch is unreachable the API falls back to a
 *  Mongo regex query on `title` + `articleCode`." Used only by
 *  `catalog/search.service.ts#searchProducts`'s catch branch. */
export async function searchProductsMongoFallback(regex: RegExp, limit: number): Promise<ProductHydratedDoc[]> {
  return ProductModel.find({ ...NOT_DELETED, status: 'active', $or: [{ title: regex }, { articleCode: regex }] })
    .limit(limit)
    .exec();
}

/** All currently-active product ids — the input to `pnpm reindex`'s full
 *  rebuild (`scripts/reindex.ts`) and `search.service.ts#fullReindex`. */
export async function listAllActiveProductIds(): Promise<string[]> {
  const rows = await ProductModel.find({ status: 'active', ...NOT_DELETED }, { _id: 1 }).lean().exec();
  return rows.map((row) => row._id.toString());
}
