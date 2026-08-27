import { z } from 'zod';
import { objectId } from './common.js';
import { ColorFamily, DupattaType, Fabric, Occasion, Season, Size, StitchingType, Work } from './enums.js';
import { Fils } from './money.js';

/**
 * Product + Variant — plan.md §7.5 / §7.6. The Pakistani-fashion-specific
 * fields (stitchingType, pieceCount, pieces[], fabric, work, dupattaType,
 * occasion, colour) and the fields the rest of the plan references
 * directly (money, status, media) are kept in full. Minor merchandising
 * fields not referenced elsewhere in the plan — `sortWeight`, `video`,
 * `model360`, `ratingAvg/ratingCount`, `soldCount/viewCount`,
 * `relatedProductIds/completeTheLookIds`, `publishedAt/archivedAt` — are
 * intentionally trimmed per the brief for this workstream; add them back
 * alongside the Mongoose models when that workstream needs them.
 */

const PIECE_COUNT = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const MediaRef = z.object({
  publicId: z.string(),
  url: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type MediaRef = z.infer<typeof MediaRef>;

export const ProductMediaItem = z.object({
  id: z.string(),
  type: z.enum(['image', 'video']),
  publicId: z.string(),
  url: z.string(),
  alt: z.string(),
  altAr: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  dominantColor: z.string(),
  sortOrder: z.number().int(),
  isPrimary: z.boolean(),
  variantId: objectId.optional(),
});
export type ProductMediaItem = z.infer<typeof ProductMediaItem>;

/** One physical piece within a suit — plan.md §7.5 `pieces[]`, e.g. a
 *  3-piece unstitched lawn suit has a shirt, trouser and dupatta piece,
 *  each with its own fabric and work. */
export const ProductPiece = z.object({
  type: z.enum(['shirt', 'trouser', 'dupatta', 'slip', 'shawl']),
  fabric: Fabric,
  lengthMeters: z.number().positive().nullable(),
  work: z.array(Work),
  descriptionEn: z.string(),
  descriptionAr: z.string(),
});
export type ProductPiece = z.infer<typeof ProductPiece>;

export const ProductSeo = z.object({
  titleEn: z.string().optional(),
  titleAr: z.string().optional(),
  descEn: z.string().optional(),
  descAr: z.string().optional(),
  canonical: z.string().optional(),
  noindex: z.boolean().default(false),
});
export type ProductSeo = z.infer<typeof ProductSeo>;

export const ProductStatus = z.enum(['draft', 'scheduled', 'active', 'archived']);
export type ProductStatus = z.infer<typeof ProductStatus>;

export const ProductBadge = z.enum(['new', 'bestseller', 'limited', 'last_pieces', 'pre_order', 'back_in_stock']);
export type ProductBadge = z.infer<typeof ProductBadge>;

export const Product = z.object({
  id: objectId,
  title: z.string(),
  titleAr: z.string(),
  slug: z.string(),
  articleCode: z.string(), // uppercase, indexed — plan.md §7.5; first searchable attribute (§7.14)
  brandId: objectId,
  categoryIds: z.array(objectId),
  primaryCategoryId: objectId,
  collectionIds: z.array(objectId),

  // Pakistani-fashion core (§2, §7.5)
  stitchingType: StitchingType,
  pieceCount: PIECE_COUNT.nullable(),
  pieces: z.array(ProductPiece),
  fabric: Fabric,
  secondaryFabrics: z.array(Fabric),
  work: z.array(Work),
  dupattaType: DupattaType.nullable(),
  occasion: z.array(Occasion),
  season: Season,
  colorName: z.string(), // brand's own name, e.g. 'Ferozi'
  colorFamily: ColorFamily,
  colorHex: z.string().regex(/^#[0-9a-f]{6}$/i),
  neckline: z.string().nullable(),
  sleeveLength: z.string().nullable(),
  shirtLength: z.string().nullable(),
  fit: z.string().nullable(),
  countryOfManufacture: z.literal('PK'),

  // Commerce
  hasVariants: z.boolean(),
  variantAxes: z.array(z.enum(['size', 'color', 'piece_count'])),
  basePriceFils: Fils, // fallback price when there are no variants — §8.2 price resolution
  compareAtPriceFils: Fils.nullable(),
  taxClass: z.enum(['standard_5', 'zero']),
  isCustomStitchAvailable: z.boolean(),
  stitchingPriceFils: Fils.nullable(),
  stitchingLeadDays: z.number().int().positive().nullable(),

  // Media
  media: z.array(ProductMediaItem),

  // Merchandising
  status: ProductStatus,
  publishAt: z.coerce.date().nullable(),
  isFeatured: z.boolean(),
  isNewIn: z.boolean(),
  isExclusive: z.boolean(),
  badges: z.array(ProductBadge),

  // Denormalised for listing performance — recomputed on write, never hand-edited
  priceRange: z.object({ minFils: Fils, maxFils: Fils }),
  effectivePriceFils: Fils, // after active automatic discounts — §8.2
  discountPercent: z.number().int().min(0).max(100),
  inStock: z.boolean(),
  totalStock: z.number().int().nonnegative(),

  seo: ProductSeo,

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Product = z.infer<typeof Product>;

/** plan.md §7.6: `options` on a variant — the axes a product can vary by. */
export const VariantOptions = z.object({
  size: Size.optional(),
  color: z.string().optional(),
  pieceCount: PIECE_COUNT.optional(),
});
export type VariantOptions = z.infer<typeof VariantOptions>;

/** Variant — plan.md §7.6. Stock is never stored here; `inventory` (a
 *  future workstream) is the single source of truth for on-hand / reserved
 *  / available. */
export const Variant = z.object({
  id: objectId,
  productId: objectId,
  sku: z.string(),
  barcode: z.string().nullable(),
  options: VariantOptions,
  priceFils: Fils,
  compareAtPriceFils: Fils.nullable(),
  costPriceFils: Fils.nullable(), // admin-only, margin reports — never sent to the storefront DTO
  weightGrams: z.number().int().positive(), // needed for courier rates
  mediaIds: z.array(z.string()),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  // Added for the `report` module's Inventory report (plan.md §11.1
  // "ageing") — the one field this schema was missing to answer "how
  // long has this variant existed" without `report` reading
  // `VariantModel` directly (plan.md §5.3).
  createdAt: z.coerce.date(),
});
export type Variant = z.infer<typeof Variant>;
