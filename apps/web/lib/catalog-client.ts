import type { Brand, ColorFamily, Collection, Fabric, Occasion, Product, Size, StitchingType, Work } from '@lulwah/contracts';
import { Collection as CollectionSchema } from '@lulwah/contracts';
import { apiFetch, apiFetchWithMeta } from './api-client';
import {
  BrandListResponse,
  CategoryTreeResponse,
  CollectionListResponse,
  ProductDetailResponse,
  ProductListResponse,
  SearchResponse,
  type CategoryTreeNode,
} from './catalog-schemas';
import { Brand as BrandSchema } from '@lulwah/contracts';

/**
 * Thin fetch functions over `apiFetch`/`apiFetchWithMeta` (`lib/api-client.ts`)
 * for the public catalog endpoints (`apps/api/.../catalog/catalog.routes.ts`).
 * Every param name below matches `ListProductsQuery` (`product.dto.ts`)
 * exactly — `category`/`brand`/`collection` are **slugs** (the service
 * resolves them server-side via `resolveSlugId`), not ids, and
 * `stitchingType`/`fabric`/`work`/`occasion`/`colorFamily`/`size` each
 * accept exactly **one** value, not a comma-joined list — the query schema
 * types them as a single optional enum, so a multi-value string would fail
 * Zod validation server-side (400 `VALIDATION_FAILED`).
 */

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'bestselling' | 'discount';

export interface ListProductsParams {
  category?: string;
  brand?: string;
  collection?: string;
  stitchingType?: StitchingType;
  fabric?: Fabric;
  work?: Work;
  occasion?: Occasion;
  colorFamily?: ColorFamily;
  size?: Size;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

export interface ListProductsResult {
  products: Product[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listProducts(params: ListProductsParams = {}): Promise<ListProductsResult> {
  const query = buildQueryString({ ...params });
  const { data, meta } = await apiFetchWithMeta(`/products${query}`, ProductListResponse);
  return {
    products: data.products,
    page: meta?.page ?? params.page ?? 1,
    limit: meta?.limit ?? params.limit ?? 24,
    total: meta?.total ?? data.products.length,
    hasMore: meta?.hasMore ?? false,
  };
}

export async function getProductBySlug(slug: string): Promise<ProductDetailResponse | null> {
  try {
    return await apiFetch(`/products/${encodeURIComponent(slug)}`, ProductDetailResponse);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function getRelatedProducts(slug: string, limit = 4): Promise<Product[]> {
  try {
    const { products } = await apiFetch(`/products/${encodeURIComponent(slug)}/related?limit=${limit}`, ProductListResponse);
    return products;
  } catch (err) {
    if (isNotFound(err)) return [];
    throw err;
  }
}

export async function listBrands(): Promise<Brand[]> {
  const { brands } = await apiFetch('/brands', BrandListResponse);
  return brands;
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  try {
    return await apiFetch(`/brands/${encodeURIComponent(slug)}`, BrandSchema);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  const { categories } = await apiFetch('/categories/tree', CategoryTreeResponse);
  return categories;
}

export async function listCollections(limit = 24): Promise<Collection[]> {
  const { collections } = await apiFetch(`/collections?limit=${limit}`, CollectionListResponse);
  return collections;
}

export async function getCollectionBySlug(slug: string): Promise<Collection | null> {
  try {
    return await apiFetch(`/collections/${encodeURIComponent(slug)}`, CollectionSchema);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function searchProducts(q: string, limit = 24): Promise<SearchResponse> {
  if (!q.trim()) return { products: [], source: 'meilisearch' };
  return apiFetch(`/search?q=${encodeURIComponent(q)}&limit=${limit}`, SearchResponse);
}

function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 'NOT_FOUND';
}
