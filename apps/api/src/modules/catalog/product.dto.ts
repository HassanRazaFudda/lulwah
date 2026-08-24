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

export const AdminCreateProductInput = z.object({
  title: z.string().min(1),
  titleAr: z.string().default(''),
  slug: z.string().min(1).optional(), // auto-generated from `title` when omitted
  articleCode: z.string().min(1),
  brandId: objectId,
  categoryIds: z.array(objectId).default([]),
  primaryCategoryId: objectId,
  collectionIds: z.array(objectId).default([]),

  stitchingType: StitchingType,
  pieceCount: PieceCount.nullable().default(null),
  pieces: z.array(ProductPiece).default([]),
  fabric: Fabric,
  secondaryFabrics: z.array(Fabric).default([]),
  work: z.array(Work).default([]),
  dupattaType: DupattaType.nullable().default(null),
  occasion: z.array(Occasion).default([]),
  season: Season,
  colorName: z.string().min(1),
  colorFamily: ColorFamily,
  colorHex: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default('#000000'),
  neckline: z.string().nullable().default(null),
  sleeveLength: z.string().nullable().default(null),
  shirtLength: z.string().nullable().default(null),
  fit: z.string().nullable().default(null),

  basePriceFils: Fils,
  compareAtPriceFils: Fils.nullable().default(null),
  taxClass: z.enum(['standard_5', 'zero']).default('standard_5'),
  isCustomStitchAvailable: z.boolean().default(false),
  stitchingPriceFils: Fils.nullable().default(null),
  stitchingLeadDays: z.number().int().positive().nullable().default(null),

  status: ProductStatus.default('draft'),
  publishAt: z.coerce.date().nullable().default(null),
  isFeatured: z.boolean().default(false),
  isNewIn: z.boolean().default(false),
  isExclusive: z.boolean().default(false),
  badges: z.array(ProductBadge).default([]),

  seo: ProductSeo.partial().default({}),
});
export type AdminCreateProductInput = z.infer<typeof AdminCreateProductInput>;

export const AdminUpdateProductInput = AdminCreateProductInput.partial();
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

export const AdminCreateVariantInput = z.object({
  sku: z.string().min(1),
  barcode: z.string().nullable().default(null),
  options: VariantOptions.default({}),
  priceFils: Fils,
  compareAtPriceFils: Fils.nullable().default(null),
  costPriceFils: Fils.nullable().default(null),
  weightGrams: z.number().int().positive(),
  mediaIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  /** Seeds the variant's `InventoryItem.onHand` at creation — the only
   *  point this module lets a caller set stock without going through
   *  `POST /admin/inventory/:variantId/adjust`'s movement trail, since
   *  there is no prior state for a brand-new variant to move *from*. */
  initialOnHand: z.number().int().nonnegative().default(0),
});
export type AdminCreateVariantInput = z.infer<typeof AdminCreateVariantInput>;

export const AdminUpdateVariantInput = AdminCreateVariantInput.omit({ initialOnHand: true }).partial();
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
