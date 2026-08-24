import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Product, ProductMediaItem, ProductStatus, Variant } from '@lulwah/contracts';
import { apiRequest } from '../api-client';
import type { ProductDraft } from '../product-draft';
import { buildQueryString } from './query-utils';

/**
 * Product data-fetching layer — `GET/POST/PATCH /admin/products*` and the
 * nested variant/media routes (plan.md §9.7, `apps/api/src/modules/
 * catalog/catalog.routes.ts`). Same `use*Query`/`use*Mutation` shape
 * `lib/queries.ts` already establishes for Orders, now pointed at the real
 * API instead of placeholder data — the catalog module merged to `master`
 * in this phase (see `docs/implemented-plan.md`).
 */

const AdminVariantWithStock = Variant.extend({
  onHand: z.number().int(),
  available: z.number().int(),
  allowBackorder: z.boolean(),
});
export type AdminVariantWithStock = z.infer<typeof AdminVariantWithStock>;

const AdminProductListResponse = z.object({ products: z.array(Product) });
const AdminProductDetailResponse = z.object({ product: Product, variants: z.array(AdminVariantWithStock) });
const AdminProductResponse = z.object({ product: Product });
const AdminVariantResponse = z.object({ variant: Variant });
const ProductMediaResponse = z.object({ media: z.array(ProductMediaItem) });

const PRODUCTS_QUERY_KEY = ['admin', 'products'] as const;
const productQueryKey = (id: string) => ['admin', 'product', id] as const;

export interface AdminProductsFilter {
  status?: ProductStatus | undefined;
}

/**
 * Fetches one generous page (limit 100 — comfortably above the ~33-product
 * seed set) rather than building server-side pagination UI, and only
 * forwards `status` as a real query param. `stitchingType`/`brand` are
 * accepted by `AdminListProductsQuery` but verified (via the real API, not
 * just reading the code) to be silently unused by `adminListProducts` in
 * `product.service.ts` — it only ever applies the `status` filter server-
 * side. Brand/stitching-type/search filtering for the Products screen is
 * therefore done client-side, in `ProductsPage`, exactly like
 * `OrdersPage`'s established fetch-all-then-filter-in-memory pattern in
 * `lib/queries.ts` — not a new pattern invented for this screen.
 */
export function useAdminProductsQuery(filter: AdminProductsFilter = {}) {
  return useQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, filter],
    queryFn: () =>
      apiRequest(`/admin/products${buildQueryString({ status: filter.status, limit: 100 })}`, AdminProductListResponse).then(
        (r) => r.products,
      ),
  });
}

export function useAdminProductQuery(id: string) {
  return useQuery({
    queryKey: productQueryKey(id),
    queryFn: () => apiRequest(`/admin/products/${id}`, AdminProductDetailResponse),
    enabled: id.length > 0,
  });
}

function draftToBody(draft: ProductDraft): Record<string, unknown> {
  // `publishAt` round-trips as a `datetime-local` input value (no seconds/
  // zone) — `AdminCreateProductInput.publishAt` is `z.coerce.date()`, which
  // parses that fine, but an empty string is not a valid date, so it must
  // become `null` rather than being sent literally.
  return { ...draft, publishAt: draft.publishAt || null };
}

export function useCreateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: ProductDraft) =>
      apiRequest('/admin/products', AdminProductResponse, { method: 'POST', body: draftToBody(draft) }).then((r) => r.product),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
    },
  });
}

export interface UpdateProductVars {
  id: string;
  draft: ProductDraft;
}

export function useUpdateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draft }: UpdateProductVars) =>
      apiRequest(`/admin/products/${id}`, AdminProductResponse, { method: 'PATCH', body: draftToBody(draft) }).then(
        (r) => r.product,
      ),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: productQueryKey(vars.id) });
    },
  });
}

// --- variants ---------------------------------------------------------------

export interface VariantInput {
  sku: string;
  barcode?: string | null;
  options: { size?: string; color?: string; pieceCount?: number };
  priceFils: number;
  compareAtPriceFils?: number | null;
  costPriceFils?: number | null;
  weightGrams: number;
  isActive?: boolean;
  sortOrder?: number;
  initialOnHand?: number;
}

export function useCreateVariantMutation(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VariantInput) =>
      apiRequest(`/admin/products/${productId}/variants`, AdminVariantResponse, { method: 'POST', body: input }).then(
        (r) => r.variant,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productQueryKey(productId) });
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
    },
  });
}

export interface UpdateVariantVars {
  variantId: string;
  input: Partial<Omit<VariantInput, 'initialOnHand'>>;
}

export function useUpdateVariantMutation(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, input }: UpdateVariantVars) =>
      apiRequest(`/admin/products/${productId}/variants/${variantId}`, AdminVariantResponse, {
        method: 'PATCH',
        body: input,
      }).then((r) => r.variant),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productQueryKey(productId) });
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
    },
  });
}

export function useDeleteVariantMutation(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variantId: string) =>
      apiRequest(`/admin/products/${productId}/variants/${variantId}`, z.object({}), { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productQueryKey(productId) });
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
    },
  });
}

// --- media (paste-a-URL only — no upload pipeline exists, see report) ------

export interface AddMediaInput {
  url: string;
  alt?: string;
  altAr?: string;
  isPrimary?: boolean;
  type?: 'image' | 'video';
}

export function useAddProductMediaMutation(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddMediaInput) =>
      apiRequest(`/admin/products/${productId}/media`, ProductMediaResponse, { method: 'POST', body: input }).then(
        (r) => r.media,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productQueryKey(productId) });
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
    },
  });
}
