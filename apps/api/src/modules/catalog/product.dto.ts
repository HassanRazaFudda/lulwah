import { z } from 'zod';
import {
  Brand,
  ColorFamily,
  DupattaType,
  Fabric,
  Fils,
  Occasion,
  PieceCount,
  Product,
  ProductBadge,
  ProductMediaItem,
  ProductPiece,
  ProductSeo,
  ProductStatus,
  Season,
  Size,
  StitchingType,
  Variant,
  VariantOptions,
  Work,
  objectId,
} from '@lulwah/contracts';

/**
 * Request/response DTOs for the `products` surface — plan.md §9.2/§9.7.
 * `Product`/`Variant` themselves live in `@lulwah/contracts` (re-used, not
 * redefined, per the brief); everything below is either an input shape
 * (narrower than the full entity — no `id`/computed fields) or a
 * module-local response composite (a PDP payload, a paginated list).
 */

// --- boolean query params: 'true'/'false' strings, not JS truthiness ------
const booleanParam = () =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true'));

export const ProductSort = z.enum(['newest', 'price_asc', 'price_desc', 'bestselling', 'discount']);
export type ProductSort = z.infer<typeof ProductSort>;

export const ListProductsQuery = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  collection: z.string().optional(),
  stitchingType: StitchingType.optional(),
  fabric: Fabric.optional(),
  work: Work.optional(),
  occasion: Occasion.optional(),
  colorFamily: ColorFamily.optional(),
  size: Size.optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  inStock: booleanParam(),
  onSale: booleanParam(),
  sort: ProductSort.default('newest'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(24),
});
export type ListProductsQuery = z.infer<typeof ListProductsQuery>;

export const AdminListProductsQuery = ListProductsQuery.extend({
  status: ProductStatus.optional(),
});
export type AdminListProductsQuery = z.infer<typeof AdminListProductsQuery>;

/** `Variant` merged with its live `inventory.available`/`allowBackorder` —
 *  what the PDP and admin variant list actually need to render (plan.md
 *  §9.2: "full PDP payload: product + variants + inventory availability"). */
export const VariantWithAvailability = Variant.extend({
  available: z.number().int(),
  allowBackorder: z.boolean(),
});
export type VariantWithAvailability = z.infer<typeof VariantWithAvailability>;

export const Breadcrumb = z.object({ name: z.string(), slug: z.string() });
export type Breadcrumb = z.infer<typeof Breadcrumb>;

export const ProductDetailResponse = z.object({
  product: Product,
  brand: Brand,
  variants: z.array(VariantWithAvailability),
  breadcrumbs: z.array(Breadcrumb),
});
export type ProductDetailResponse = z.infer<typeof ProductDetailResponse>;

export const ProductListResponse = z.object({ products: z.array(Product) });
export type ProductListResponse = z.infer<typeof ProductListResponse>;

export const RelatedProductsResponse = z.object({ products: z.array(Product) });
export type RelatedProductsResponse = z.infer<typeof RelatedProductsResponse>;

// ---------------------------------------------------------------------------
// Admin — create/update product
// ---------------------------------------------------------------------------

/**
 * `AdminUpdateProductInput` is built from `BASE_FIELDS` (no `.default()`
 * anywhere in it) rather than `AdminCreateProductInput.partial()` — a real
 * bug found while building the `pricing`/`cart`/`identity` (address)
 * modules' own admin/customer CRUD DTOs, which hit the exact same pattern
 * (see `pricing.dto.ts`'s doc comment for the mechanism): Zod's
 * `.partial()` still fires a field's own `.default(...)` when that key is
 * entirely absent from the input, so `PATCH /admin/products/:id
 * { basePriceFils: 25000 }` was silently resetting `status` to `'draft'`,
 * `badges` to `[]`, `isFeatured`/`isNewIn`/`isExclusive` to `false`,
 * `compareAtPriceFils` to `null`, etc. on every partial edit that didn't
 * happen to also re-send those fields — e.g. editing just the price on a
 * live, featured, on-sale product would have silently un-published it,
 * un-featured it, and dropped its compare-at price.
 */
const BASE_PRODUCT_FIELDS = {
  title: z.string().min(1),
  titleAr: z.string(),
  slug: z.string().min(1).optional(), // auto-generated from `title` when omitted
  articleCode: z.string().min(1),
  brandId: objectId,
  categoryIds: z.array(objectId),
  primaryCategoryId: objectId,
  collectionIds: z.array(objectId),

  stitchingType: StitchingType,
  pieceCount: PieceCount.nullable(),
  pieces: z.array(ProductPiece),
  fabric: Fabric,
  secondaryFabrics: z.array(Fabric),
  work: z.array(Work),
  dupattaType: DupattaType.nullable(),
  occasion: z.array(Occasion),
  season: Season,
  colorName: z.string().min(1),
  colorFamily: ColorFamily,
  colorHex: z.string().regex(/^#[0-9a-f]{6}$/i),
  neckline: z.string().nullable(),
  sleeveLength: z.string().nullable(),
  shirtLength: z.string().nullable(),
  fit: z.string().nullable(),

  basePriceFils: Fils,
  compareAtPriceFils: Fils.nullable(),
  taxClass: z.enum(['standard_5', 'zero']),
  isCustomStitchAvailable: z.boolean(),
  stitchingPriceFils: Fils.nullable(),
  stitchingLeadDays: z.number().int().positive().nullable(),

  status: ProductStatus,
  publishAt: z.coerce.date().nullable(),
  isFeatured: z.boolean(),
  isNewIn: z.boolean(),
  isExclusive: z.boolean(),
  badges: z.array(ProductBadge),

  seo: ProductSeo.partial(),
};

export const AdminCreateProductInput = z.object({
  ...BASE_PRODUCT_FIELDS,
  titleAr: BASE_PRODUCT_FIELDS.titleAr.default(''),
  categoryIds: BASE_PRODUCT_FIELDS.categoryIds.default([]),
  collectionIds: BASE_PRODUCT_FIELDS.collectionIds.default([]),
  pieceCount: BASE_PRODUCT_FIELDS.pieceCount.default(null),
  pieces: BASE_PRODUCT_FIELDS.pieces.default([]),
  secondaryFabrics: BASE_PRODUCT_FIELDS.secondaryFabrics.default([]),
  work: BASE_PRODUCT_FIELDS.work.default([]),
  dupattaType: BASE_PRODUCT_FIELDS.dupattaType.default(null),
  occasion: BASE_PRODUCT_FIELDS.occasion.default([]),
  colorHex: BASE_PRODUCT_FIELDS.colorHex.default('#000000'),
  neckline: BASE_PRODUCT_FIELDS.neckline.default(null),
  sleeveLength: BASE_PRODUCT_FIELDS.sleeveLength.default(null),
  shirtLength: BASE_PRODUCT_FIELDS.shirtLength.default(null),
  fit: BASE_PRODUCT_FIELDS.fit.default(null),
  compareAtPriceFils: BASE_PRODUCT_FIELDS.compareAtPriceFils.default(null),
  taxClass: BASE_PRODUCT_FIELDS.taxClass.default('standard_5'),
  isCustomStitchAvailable: BASE_PRODUCT_FIELDS.isCustomStitchAvailable.default(false),
  stitchingPriceFils: BASE_PRODUCT_FIELDS.stitchingPriceFils.default(null),
  stitchingLeadDays: BASE_PRODUCT_FIELDS.stitchingLeadDays.default(null),
  status: BASE_PRODUCT_FIELDS.status.default('draft'),
  publishAt: BASE_PRODUCT_FIELDS.publishAt.default(null),
  isFeatured: BASE_PRODUCT_FIELDS.isFeatured.default(false),
  isNewIn: BASE_PRODUCT_FIELDS.isNewIn.default(false),
  isExclusive: BASE_PRODUCT_FIELDS.isExclusive.default(false),
  badges: BASE_PRODUCT_FIELDS.badges.default([]),
  seo: BASE_PRODUCT_FIELDS.seo.default({}),
});
export type AdminCreateProductInput = z.infer<typeof AdminCreateProductInput>;

export const AdminUpdateProductInput = z.object(BASE_PRODUCT_FIELDS).partial();
export type AdminUpdateProductInput = z.infer<typeof AdminUpdateProductInput>;

export const AdminProductResponse = z.object({ product: Product });
export type AdminProductResponse = z.infer<typeof AdminProductResponse>;

/** `GET /admin/products/:id` — the product editor needs cost price (admin-
 *  only, per `Variant`'s own comment) and live stock alongside each
 *  variant, not just the public `Variant` shape. */
export const AdminVariantWithStock = Variant.extend({
  onHand: z.number().int(),
  available: z.number().int(),
  allowBackorder: z.boolean(),
});
export type AdminVariantWithStock = z.infer<typeof AdminVariantWithStock>;

export const AdminProductDetailResponse = z.object({ product: Product, variants: z.array(AdminVariantWithStock) });
export type AdminProductDetailResponse = z.infer<typeof AdminProductDetailResponse>;

// ---------------------------------------------------------------------------
// Admin — variants
// ---------------------------------------------------------------------------

/** Same `BASE_FIELDS`-without-`.default()` fix as `AdminUpdateProductInput`
 *  above — the previous `AdminCreateVariantInput.omit(...).partial()` was
 *  silently resetting `isActive` to `true` and `mediaIds` to `[]` on every
 *  partial variant edit. */
const BASE_VARIANT_FIELDS = {
  sku: z.string().min(1),
  barcode: z.string().nullable(),
  options: VariantOptions,
  priceFils: Fils,
  compareAtPriceFils: Fils.nullable(),
  costPriceFils: Fils.nullable(),
  weightGrams: z.number().int().positive(),
  mediaIds: z.array(z.string()),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
};

export const AdminCreateVariantInput = z.object({
  ...BASE_VARIANT_FIELDS,
  barcode: BASE_VARIANT_FIELDS.barcode.default(null),
  options: BASE_VARIANT_FIELDS.options.default({}),
  compareAtPriceFils: BASE_VARIANT_FIELDS.compareAtPriceFils.default(null),
  costPriceFils: BASE_VARIANT_FIELDS.costPriceFils.default(null),
  mediaIds: BASE_VARIANT_FIELDS.mediaIds.default([]),
  isActive: BASE_VARIANT_FIELDS.isActive.default(true),
  sortOrder: BASE_VARIANT_FIELDS.sortOrder.default(0),
  /** Seeds the variant's `InventoryItem.onHand` at creation — the only
   *  point this module lets a caller set stock without going through
   *  `POST /admin/inventory/:variantId/adjust`'s movement trail, since
   *  there is no prior state for a brand-new variant to move *from*. */
  initialOnHand: z.number().int().nonnegative().default(0),
});
export type AdminCreateVariantInput = z.infer<typeof AdminCreateVariantInput>;

export const AdminUpdateVariantInput = z.object(BASE_VARIANT_FIELDS).partial();
export type AdminUpdateVariantInput = z.infer<typeof AdminUpdateVariantInput>;

export const AdminVariantResponse = z.object({ variant: Variant });
export type AdminVariantResponse = z.infer<typeof AdminVariantResponse>;

// ---------------------------------------------------------------------------
// Admin — media (plan.md brief: "accept an already-hosted URL for now")
// ---------------------------------------------------------------------------

export const AddProductMediaInput = z.object({
  url: z.string().url(),
  alt: z.string().default(''),
  altAr: z.string().default(''),
  isPrimary: z.boolean().default(false),
  type: z.enum(['image', 'video']).default('image'),
});
export type AddProductMediaInput = z.infer<typeof AddProductMediaInput>;

export const ProductMediaResponse = z.object({ media: z.array(ProductMediaItem) });
export type ProductMediaResponse = z.infer<typeof ProductMediaResponse>;
