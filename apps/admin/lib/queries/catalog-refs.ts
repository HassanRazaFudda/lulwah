import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Brand, Category, Collection } from '@lulwah/contracts';
import { apiRequest } from '../api-client';

/**
 * Read-only reference lists (`GET /admin/brands`, `/admin/categories`,
 * `/admin/collections`) that the product editor's Basics tab populates its
 * brand/category/collection selects from (plan.md §11.1). These endpoints
 * are RBAC-gated the same as `/admin/products` (`requireCatalogRead()`) but
 * return their full un-paginated-in-practice set at the default page size —
 * 6 brands, 46 categories, 3 collections in the seed data, all comfortably
 * under each endpoint's own limit — so a single fetch each is enough to
 * populate a `<select>` without building pagination UI for what is
 * effectively small, slow-changing reference data.
 */

const BrandsResponse = z.object({ brands: z.array(Brand) });
const CategoriesResponse = z.object({ categories: z.array(Category) });
const CollectionsResponse = z.object({ collections: z.array(Collection) });

export function useAdminBrandsQuery() {
  return useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: () => apiRequest('/admin/brands?limit=50', BrandsResponse).then((r) => r.brands),
  });
}

export function useAdminCategoriesQuery() {
  return useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => apiRequest('/admin/categories?limit=200', CategoriesResponse).then((r) => r.categories),
  });
}

export function useAdminCollectionsQuery() {
  return useQuery({
    queryKey: ['admin', 'collections'],
    queryFn: () => apiRequest('/admin/collections?limit=100', CollectionsResponse).then((r) => r.collections),
  });
}
