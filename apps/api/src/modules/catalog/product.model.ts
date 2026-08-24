import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type {
  ColorFamily,
  DupattaType,
  Fabric,
  Occasion,
  ProductBadge,
  ProductStatus,
  Season,
  StitchingType,
  Work,
} from '@lulwah/contracts';

/**
 * Mongoose schema for `products` — plan.md §7.5. Mirrors
 * `@lulwah/contracts`' `Product` Zod schema field-for-field (so
 * `product.mapper.ts` is a straight copy, not a reshape), plus a couple of
 * fields that are internal-only and never cross the mapper into the public
 * DTO: `deletedAt` (soft delete, plan.md §7's collection convention) and
 * `soldCount` (kept at 0 until the `order` module exists to increment it —
 * needed now only so `sort=bestselling` has a stable field to sort on
 * without crashing).
 */

export interface ProductPieceSubdoc {
  type: 'shirt' | 'trouser' | 'dupatta' | 'slip' | 'shawl';
  fabric: Fabric;
  lengthMeters: number | null;
  work: Work[];
  descriptionEn: string;
  descriptionAr: string;
}

const productPieceSchema = new Schema<ProductPieceSubdoc>(
  {
    type: { type: String, enum: ['shirt', 'trouser', 'dupatta', 'slip', 'shawl'], required: true },
    fabric: { type: String, required: true },
    lengthMeters: { type: Number, default: null },
    work: { type: [String], default: [] },
    descriptionEn: { type: String, default: '' },
    descriptionAr: { type: String, default: '' },
  },
  { _id: false },
);

export interface ProductMediaSubdoc {
  id: string;
  type: 'image' | 'video';
  publicId: string;
  url: string;
  alt: string;
  altAr: string;
  width: number;
  height: number;
  dominantColor: string;
  sortOrder: number;
  isPrimary: boolean;
  variantId: Types.ObjectId | null;
}

const productMediaSchema = new Schema<ProductMediaSubdoc>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'], required: true, default: 'image' },
    publicId: { type: String, required: true },
    url: { type: String, required: true },
    alt: { type: String, default: '' },
    altAr: { type: String, default: '' },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    dominantColor: { type: String, default: '#ffffff' },
    sortOrder: { type: Number, default: 0 },
    isPrimary: { type: Boolean, default: false },
    variantId: { type: Schema.Types.ObjectId, default: null },
  },
  { _id: false },
);

export interface ProductSeoSubdoc {
  titleEn: string | null;
  titleAr: string | null;
  descEn: string | null;
  descAr: string | null;
  canonical: string | null;
  noindex: boolean;
}

const productSeoSchema = new Schema<ProductSeoSubdoc>(
  {
    titleEn: { type: String, default: null },
    titleAr: { type: String, default: null },
    descEn: { type: String, default: null },
    descAr: { type: String, default: null },
    canonical: { type: String, default: null },
    noindex: { type: Boolean, default: false },
  },
  { _id: false },
);

export interface ProductDoc {
  _id: Types.ObjectId;
  title: string;
  titleAr: string;
  slug: string;
  articleCode: string;
  brandId: Types.ObjectId;
  categoryIds: Types.ObjectId[];
  primaryCategoryId: Types.ObjectId;
  collectionIds: Types.ObjectId[];

  stitchingType: StitchingType;
  pieceCount: 1 | 2 | 3 | null;
  pieces: ProductPieceSubdoc[];
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
  countryOfManufacture: 'PK';

  hasVariants: boolean;
  variantAxes: ('size' | 'color' | 'piece_count')[];
  basePriceFils: number;
  compareAtPriceFils: number | null;
  taxClass: 'standard_5' | 'zero';
  isCustomStitchAvailable: boolean;
  stitchingPriceFils: number | null;
  stitchingLeadDays: number | null;

  media: ProductMediaSubdoc[];

  status: ProductStatus;
  publishAt: Date | null;
  isFeatured: boolean;
  isNewIn: boolean;
  isExclusive: boolean;
  badges: ProductBadge[];

  // Denormalised for listing performance — recomputed on write, never hand-edited.
  priceRange: { minFils: number; maxFils: number };
  effectivePriceFils: number;
  discountPercent: number;
  inStock: boolean;
  totalStock: number;
  soldCount: number; // internal-only — see file doc comment

  seo: ProductSeoSubdoc;

  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductDoc>(
  {
    title: { type: String, required: true, trim: true },
    titleAr: { type: String, default: '' },
    slug: { type: String, required: true, lowercase: true, trim: true },
    articleCode: { type: String, required: true, uppercase: true, trim: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand', required: true },
    categoryIds: { type: [Schema.Types.ObjectId], ref: 'Category', default: [] },
    primaryCategoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    collectionIds: { type: [Schema.Types.ObjectId], ref: 'Collection', default: [] },

    stitchingType: { type: String, enum: ['unstitched', 'semi_stitched', 'pret', 'custom_stitchable'], required: true },
    pieceCount: { type: Number, enum: [1, 2, 3, null], default: null },
    pieces: { type: [productPieceSchema], default: [] },
    fabric: { type: String, required: true },
    secondaryFabrics: { type: [String], default: [] },
    work: { type: [String], default: [] },
    dupattaType: { type: String, default: null },
    occasion: { type: [String], default: [] },
    season: { type: String, enum: ['summer', 'winter', 'all_season', 'festive'], required: true },
    colorName: { type: String, required: true },
    colorFamily: { type: String, required: true },
    colorHex: { type: String, required: true },
    neckline: { type: String, default: null },
    sleeveLength: { type: String, default: null },
    shirtLength: { type: String, default: null },
    fit: { type: String, default: null },
    countryOfManufacture: { type: String, enum: ['PK'], required: true, default: 'PK' },

    hasVariants: { type: Boolean, default: false },
    variantAxes: { type: [String], default: [] },
    basePriceFils: { type: Number, required: true, min: 0 },
    compareAtPriceFils: { type: Number, default: null, min: 0 },
    taxClass: { type: String, enum: ['standard_5', 'zero'], required: true, default: 'standard_5' },
    isCustomStitchAvailable: { type: Boolean, default: false },
    stitchingPriceFils: { type: Number, default: null },
    stitchingLeadDays: { type: Number, default: null },

    media: { type: [productMediaSchema], default: [] },

    status: { type: String, enum: ['draft', 'scheduled', 'active', 'archived'], required: true, default: 'draft' },
    publishAt: { type: Date, default: null },
    isFeatured: { type: Boolean, default: false },
    isNewIn: { type: Boolean, default: false },
    isExclusive: { type: Boolean, default: false },
    badges: { type: [String], default: [] },

    priceRange: {
      type: new Schema({ minFils: { type: Number, required: true }, maxFils: { type: Number, required: true } }, { _id: false }),
      required: true,
    },
    effectivePriceFils: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    inStock: { type: Boolean, default: false },
    totalStock: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },

    seo: { type: productSeoSchema, default: () => ({}) },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'products' },
);

// plan.md §7.14 index list — the main facet path plus lookup paths the
// endpoints in this module actually query.
productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ brandId: 1, status: 1 });
productSchema.index({ categoryIds: 1, status: 1 });
productSchema.index({ collectionIds: 1, status: 1 });
productSchema.index({ stitchingType: 1, fabric: 1, status: 1 });
productSchema.index({ effectivePriceFils: 1, status: 1 });
productSchema.index({ articleCode: 1 });
productSchema.index({ inStock: 1, status: 1, createdAt: -1 });

export type ProductHydratedDoc = HydratedDocument<ProductDoc>;
export const ProductModel = model<ProductDoc>('Product', productSchema);
