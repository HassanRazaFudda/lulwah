import type {
  ColorFamily,
  DupattaType,
  Fabric,
  Occasion,
  PieceCount,
  Product,
  ProductBadge,
  ProductPiece,
  ProductSeo,
  ProductStatus,
  Season,
  StitchingType,
  Work,
} from '@lulwah/contracts';

/**
 * The product editor's form-state shape — mirrors `apps/api`'s
 * `AdminCreateProductInput` field-for-field (see
 * `apps/api/src/modules/catalog/product.dto.ts`), but that Zod object lives
 * in `apps/api` and isn't importable from `apps/admin` (no cross-app
 * dependency, plan.md §6's package boundary). Redefined here as a plain TS
 * interface built from `@lulwah/contracts`' shared enums/entity fragments
 * so the two shapes can't drift silently on the parts that matter (enum
 * membership) even though the object shape itself is duplicated.
 *
 * Every field is required here (unlike the server DTO, where most have
 * Zod `.default()`s) because the editor always renders a fully-populated
 * form — defaults are applied once, by `emptyProductDraft`, not per-submit.
 */
export interface ProductDraft {
  title: string;
  titleAr: string;
  slug: string;
  articleCode: string;
  brandId: string;
  categoryIds: string[];
  primaryCategoryId: string;
  collectionIds: string[];

  stitchingType: StitchingType;
  pieceCount: PieceCount | null;
  pieces: ProductPiece[];
  fabric: Fabric;
  secondaryFabrics: Fabric[];
  work: Work[];
  dupattaType: DupattaType | null;
  occasion: Occasion[];
  season: Season;
  colorName: string;
  colorFamily: ColorFamily;
  colorHex: string;
  neckline: string | null;
  sleeveLength: string | null;
  shirtLength: string | null;
  fit: string | null;

  basePriceFils: number;
  compareAtPriceFils: number | null;
  taxClass: 'standard_5' | 'zero';
  isCustomStitchAvailable: boolean;
  stitchingPriceFils: number | null;
  stitchingLeadDays: number | null;

  status: ProductStatus;
  publishAt: string | null; // datetime-local input value; server coerces to Date
  isFeatured: boolean;
  isNewIn: boolean;
  isExclusive: boolean;
  badges: ProductBadge[];

  seo: Partial<ProductSeo>;
}

/** The new-product route's starting point. Enum fields default to their
 *  first/most-common member (the form is fully editable immediately after);
 *  `brandId`/`primaryCategoryId` start empty since there's no sane default
 *  reference id — the editor blocks submit until both are chosen. */
export function emptyProductDraft(): ProductDraft {
  return {
    title: '',
    titleAr: '',
    slug: '',
    articleCode: '',
    brandId: '',
    categoryIds: [],
    primaryCategoryId: '',
    collectionIds: [],

    stitchingType: 'unstitched',
    pieceCount: null,
    pieces: [],
    fabric: 'lawn',
    secondaryFabrics: [],
    work: [],
    dupattaType: null,
    occasion: [],
    season: 'all_season',
    colorName: '',
    colorFamily: 'white_offwhite',
    colorHex: '#000000',
    neckline: null,
    sleeveLength: null,
    shirtLength: null,
    fit: null,

    basePriceFils: 0,
    compareAtPriceFils: null,
    taxClass: 'standard_5',
    isCustomStitchAvailable: false,
    stitchingPriceFils: null,
    stitchingLeadDays: null,

    status: 'draft',
    publishAt: null,
    isFeatured: false,
    isNewIn: false,
    isExclusive: false,
    badges: [],

    seo: {},
  };
}

/** Maps a loaded `Product` (the full entity, with computed/read-only fields
 *  like `id`/`media`/`priceRange`) down to the editable subset the form
 *  actually owns. */
export function productToDraft(product: Product): ProductDraft {
  return {
    title: product.title,
    titleAr: product.titleAr,
    slug: product.slug,
    articleCode: product.articleCode,
    brandId: product.brandId,
    categoryIds: product.categoryIds,
    primaryCategoryId: product.primaryCategoryId,
    collectionIds: product.collectionIds,

    stitchingType: product.stitchingType,
    pieceCount: product.pieceCount,
    pieces: product.pieces,
    fabric: product.fabric,
    secondaryFabrics: product.secondaryFabrics,
    work: product.work,
    dupattaType: product.dupattaType,
    occasion: product.occasion,
    season: product.season,
    colorName: product.colorName,
    colorFamily: product.colorFamily,
    colorHex: product.colorHex,
    neckline: product.neckline,
    sleeveLength: product.sleeveLength,
    shirtLength: product.shirtLength,
    fit: product.fit,

    basePriceFils: product.basePriceFils,
    compareAtPriceFils: product.compareAtPriceFils,
    taxClass: product.taxClass,
    isCustomStitchAvailable: product.isCustomStitchAvailable,
    stitchingPriceFils: product.stitchingPriceFils,
    stitchingLeadDays: product.stitchingLeadDays,

    status: product.status,
    publishAt: product.publishAt ? new Date(product.publishAt).toISOString().slice(0, 16) : null,
    isFeatured: product.isFeatured,
    isNewIn: product.isNewIn,
    isExclusive: product.isExclusive,
    badges: product.badges,

    seo: product.seo,
  };
}
