import { z } from 'zod';
import { Brand, Category, Collection, Product, Variant } from '@lulwah/contracts';

/**
 * Response-shape schemas for the catalog endpoints (`apps/api/src/modules/
 * catalog/catalog.routes.ts`). These composite shapes (a PDP payload, a
 * paginated list, a search result) are defined API-side in that module's
 * own `*.dto.ts` files, not in `@lulwah/contracts` — `apps/web` can't import
 * from `apps/api/src/*` (that would cross the app boundary plan.md §5.2
 * draws between them), so the same shapes are re-declared here, built from
 * the shared `@lulwah/contracts` primitives so they can never drift on the
 * *entity* fields, only intentionally on the *envelope* shape per endpoint.
 *
 * `apiFetch` validates every response against one of these before handing
 * data back to a Server Component — if the API ever changes one of these
 * response shapes without a matching update here, every affected page fails
 * loudly (a thrown `ApiError('UNKNOWN_RESPONSE_SHAPE', ...)`), not silently.
 */

// --- GET /products, GET /products/:slug/related ---------------------------
export const ProductListResponse = z.object({ products: z.array(Product) });
export type ProductListResponse = z.infer<typeof ProductListResponse>;

// --- GET /products/:slug ----------------------------------------------------
/** `Variant` merged with its live `inventory.available`/`allowBackorder` —
 *  mirrors `apps/api/.../catalog/product.dto.ts`'s `VariantWithAvailability`. */
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

// --- GET /brands, GET /brands/:slug -----------------------------------------
export const BrandListResponse = z.object({ brands: z.array(Brand) });
export type BrandListResponse = z.infer<typeof BrandListResponse>;

// `GET /brands/:slug` returns the bare `Brand` object (no wrapper) — see
// `brand.controller.ts`'s `getPublicBySlug` (`sendSuccess(res, brand)`).

// --- GET /categories/tree ---------------------------------------------------
export type CategoryTreeNode = Category & { children: CategoryTreeNode[] };
export const CategoryTreeNode: z.ZodType<CategoryTreeNode> = z.lazy(() =>
  Category.extend({ children: z.array(CategoryTreeNode) }),
);

export const CategoryTreeResponse = z.object({ categories: z.array(CategoryTreeNode) });
export type CategoryTreeResponse = z.infer<typeof CategoryTreeResponse>;

// --- GET /collections --------------------------------------------------------
export const CollectionListResponse = z.object({ collections: z.array(Collection) });
export type CollectionListResponse = z.infer<typeof CollectionListResponse>;

// `GET /collections/:slug` returns the bare `Collection` object — see
// `collection.controller.ts`'s `getPublicBySlug`.

// --- GET /search --------------------------------------------------------------
export const SearchResponse = z.object({
  products: z.array(Product),
  source: z.enum(['meilisearch', 'mongo_fallback']),
});
export type SearchResponse = z.infer<typeof SearchResponse>;
