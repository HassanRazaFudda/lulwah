import type { Product, Variant } from '@lulwah/contracts';
import type { ProductDoc, ProductHydratedDoc } from './product.model.js';
import type { VariantDoc, VariantHydratedDoc } from './variant.model.js';

/** `soldCount`/`viewCount` and other internal-only fields never cross into
 *  the public `Product` DTO — see `product.model.ts`'s doc comment. */
export function toProductDto(doc: ProductDoc | ProductHydratedDoc): Product {
  return {
    id: doc._id.toString(),
    title: doc.title,
    titleAr: doc.titleAr,
    slug: doc.slug,
    articleCode: doc.articleCode,
    brandId: doc.brandId.toString(),
    categoryIds: doc.categoryIds.map((id) => id.toString()),
    primaryCategoryId: doc.primaryCategoryId.toString(),
    collectionIds: doc.collectionIds.map((id) => id.toString()),

    stitchingType: doc.stitchingType,
    pieceCount: doc.pieceCount,
    pieces: doc.pieces.map((piece) => ({
      type: piece.type,
      fabric: piece.fabric,
      lengthMeters: piece.lengthMeters,
      work: piece.work,
      descriptionEn: piece.descriptionEn,
      descriptionAr: piece.descriptionAr,
    })),
    fabric: doc.fabric,
    secondaryFabrics: doc.secondaryFabrics,
    work: doc.work,
    dupattaType: doc.dupattaType,
    occasion: doc.occasion,
    season: doc.season,
    colorName: doc.colorName,
    colorFamily: doc.colorFamily,
    colorHex: doc.colorHex,
    neckline: doc.neckline,
    sleeveLength: doc.sleeveLength,
    shirtLength: doc.shirtLength,
    fit: doc.fit,
    countryOfManufacture: doc.countryOfManufacture,

    hasVariants: doc.hasVariants,
    variantAxes: doc.variantAxes,
    basePriceFils: doc.basePriceFils,
    compareAtPriceFils: doc.compareAtPriceFils,
    taxClass: doc.taxClass,
    isCustomStitchAvailable: doc.isCustomStitchAvailable,
    stitchingPriceFils: doc.stitchingPriceFils,
    stitchingLeadDays: doc.stitchingLeadDays,

    media: doc.media.map((item) => ({
      id: item.id,
      type: item.type,
      publicId: item.publicId,
      url: item.url,
      alt: item.alt,
      altAr: item.altAr,
      width: item.width,
      height: item.height,
      dominantColor: item.dominantColor,
      sortOrder: item.sortOrder,
      isPrimary: item.isPrimary,
      ...(item.variantId ? { variantId: item.variantId.toString() } : {}),
    })),

    status: doc.status,
    publishAt: doc.publishAt,
    isFeatured: doc.isFeatured,
    isNewIn: doc.isNewIn,
    isExclusive: doc.isExclusive,
    badges: doc.badges,

    priceRange: doc.priceRange,
    effectivePriceFils: doc.effectivePriceFils,
    discountPercent: doc.discountPercent,
    inStock: doc.inStock,
    totalStock: doc.totalStock,

    seo: {
      ...(doc.seo.titleEn ? { titleEn: doc.seo.titleEn } : {}),
      ...(doc.seo.titleAr ? { titleAr: doc.seo.titleAr } : {}),
      ...(doc.seo.descEn ? { descEn: doc.seo.descEn } : {}),
      ...(doc.seo.descAr ? { descAr: doc.seo.descAr } : {}),
      ...(doc.seo.canonical ? { canonical: doc.seo.canonical } : {}),
      noindex: doc.seo.noindex,
    },

    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** `costPriceFils` is deliberately dropped — "admin-only, margin reports —
 *  never sent to the storefront DTO" (plan.md §7.6, `@lulwah/contracts`'
 *  own comment on `Variant`). Public callers get `toVariantDto`; the admin
 *  product editor gets `toAdminVariantDto` below, which keeps it. */
export function toVariantDto(doc: VariantDoc | VariantHydratedDoc): Variant {
  return {
    id: doc._id.toString(),
    productId: doc.productId.toString(),
    sku: doc.sku,
    barcode: doc.barcode,
    options: {
      ...(doc.options.size ? { size: doc.options.size } : {}),
      ...(doc.options.color ? { color: doc.options.color } : {}),
      ...(doc.options.pieceCount ? { pieceCount: doc.options.pieceCount } : {}),
    },
    priceFils: doc.priceFils,
    compareAtPriceFils: doc.compareAtPriceFils,
    costPriceFils: null,
    weightGrams: doc.weightGrams,
    mediaIds: doc.mediaIds,
    isActive: doc.isActive,
    sortOrder: doc.sortOrder,
  };
}

export function toAdminVariantDto(doc: VariantDoc | VariantHydratedDoc): Variant {
  return { ...toVariantDto(doc), costPriceFils: doc.costPriceFils };
}
