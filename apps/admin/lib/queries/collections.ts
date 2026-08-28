import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Collection, CollectionLayout, CollectionRule, CollectionStatus, CollectionType, MediaRef } from '@lulwah/contracts';
import { apiRequest } from '../api-client';

/**
 * Collections CRUD — `GET/POST/PATCH/DELETE /admin/collections*`
 * (`apps/api/src/modules/catalog/collection.routes.ts`, NOT `content`: per
 * this task's brief, Collections extended the pre-existing `catalog`
 * module's `Collection` — `type: 'automated'` + `rules[]`,
 * `heroImageMobile`, `isTeaserVisible` on top of the P1 shape — rather than
 * getting a second, parallel model in `content`).
 *
 * `lib/queries/catalog-refs.ts#useAdminCollectionsQuery` already reads this
 * same `GET /admin/collections` endpoint (used read-only by the product
 * editor's Basics tab to populate a collection checklist) — this file adds
 * the create/update/delete mutations Content's new Collections tab needs,
 * sharing that hook's exact query key (`['admin', 'collections']`) so a
 * write here invalidates the product editor's list too, and vice versa.
 * Before this task, no admin UI anywhere wrote to this endpoint at all —
 * confirmed by search, not assumed; see this task's report for why the
 * fuller Collections tab lives here rather than under `products/`.
 */

const COLLECTIONS_QUERY_KEY = ['admin', 'collections'] as const;
const AdminCollectionResponse = z.object({ collection: Collection });

export interface CollectionDraft {
  name: string;
  nameAr: string;
  slug?: string;
  subtitle: string;
  descriptionEn: string;
  descriptionAr: string;
  brandId: string | null;
  type: CollectionType;
  rules: CollectionRule[];
  productIds: string[];
  heroImage: MediaRef | null;
  heroImageMobile: MediaRef | null;
  launchAt: string | null;
  endAt: string | null;
  isTeaserVisible: boolean;
  status: CollectionStatus;
  layout: CollectionLayout;
  sortOrder: number;
  isFeatured: boolean;
}

export function useCreateCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: CollectionDraft) =>
      apiRequest('/admin/collections', AdminCollectionResponse, { method: 'POST', body: draft }).then(
        (r) => r.collection,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY }),
  });
}

export interface UpdateCollectionVars {
  id: string;
  draft: Partial<CollectionDraft>;
}

export function useUpdateCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draft }: UpdateCollectionVars) =>
      apiRequest(`/admin/collections/${id}`, AdminCollectionResponse, { method: 'PATCH', body: draft }).then(
        (r) => r.collection,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY }),
  });
}

interface ReorderCollectionProductsContext {
  previous: Collection[] | undefined;
}

/** Optimistic `productIds` reorder for a manually-curated collection —
 *  plan.md §11.1: "manual ordering by drag." */
export function useReorderCollectionProductsMutation() {
  const queryClient = useQueryClient();
  return useMutation<Collection, Error, { id: string; productIds: string[] }, ReorderCollectionProductsContext>({
    mutationFn: ({ id, productIds }) =>
      apiRequest(`/admin/collections/${id}`, AdminCollectionResponse, {
        method: 'PATCH',
        body: { productIds },
      }).then((r) => r.collection),
    onMutate: async ({ id, productIds }) => {
      await queryClient.cancelQueries({ queryKey: COLLECTIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<Collection[]>(COLLECTIONS_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<Collection[]>(
          COLLECTIONS_QUERY_KEY,
          previous.map((c) => (c.id === id ? { ...c, productIds } : c)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(COLLECTIONS_QUERY_KEY, context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY }),
  });
}

export function useDeleteCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/collections/${id}`, z.object({}), { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY }),
  });
}

// Re-exported so `CollectionsPanel.tsx` has one import site for both the
// read query and the mutations above, without duplicating the list fetch
// `catalog-refs.ts` already implements.
export { useAdminCollectionsQuery } from './catalog-refs';
