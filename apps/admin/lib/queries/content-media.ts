import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { MediaAsset, MediaAssetType } from '@lulwah/contracts';
import { apiRequest } from '../api-client';
import { buildQueryString } from './query-utils';

/**
 * Media-library data-fetching layer — `GET/POST/PATCH/DELETE
 * /admin/content/media*` + `GET /admin/content/media/folders` +
 * `PATCH /admin/content/media/bulk` (plan.md §11.1: "folders, search,
 * alt-text bulk edit"). This is a metadata layer over already-hosted URLs —
 * `AdminCreateMediaAssetInput` takes a `url` directly, the same
 * paste-a-URL precedent `catalog/product.dto.ts#AddProductMediaInput`
 * already set (see `docs/implemented-plan.md` §6.3) — there is no
 * upload/S3 pipeline anywhere in this codebase to extend, confirmed by
 * reading `media-asset.service.ts`'s own doc comment, not assumed.
 */

const AdminMediaAssetListResponse = z.object({ assets: z.array(MediaAsset) });
const AdminMediaAssetResponse = z.object({ asset: MediaAsset });
const MediaFoldersResponse = z.object({ folders: z.array(z.string()) });

const MEDIA_QUERY_KEY = ['admin', 'content', 'media'] as const;
const MEDIA_FOLDERS_QUERY_KEY = ['admin', 'content', 'media-folders'] as const;

export interface MediaAssetsFilter {
  folder?: string | undefined;
  search?: string | undefined;
  tag?: string | undefined;
  type?: MediaAssetType | undefined;
}

export function useAdminMediaAssetsQuery(filter: MediaAssetsFilter = {}) {
  return useQuery({
    queryKey: [...MEDIA_QUERY_KEY, filter],
    queryFn: () =>
      apiRequest(
        `/admin/content/media${buildQueryString({
          folder: filter.folder,
          search: filter.search,
          tag: filter.tag,
          type: filter.type,
          limit: 200,
        })}`,
        AdminMediaAssetListResponse,
      ).then((r) => r.assets),
  });
}

export function useAdminMediaFoldersQuery() {
  return useQuery({
    queryKey: MEDIA_FOLDERS_QUERY_KEY,
    queryFn: () => apiRequest('/admin/content/media/folders', MediaFoldersResponse).then((r) => r.folders),
  });
}

export interface CreateMediaAssetInput {
  url: string;
  type: MediaAssetType;
  alt: string;
  altAr: string;
  folder: string;
  tags: string[];
}

export function useCreateMediaAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMediaAssetInput) =>
      apiRequest('/admin/content/media', AdminMediaAssetResponse, { method: 'POST', body: input }).then((r) => r.asset),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MEDIA_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: MEDIA_FOLDERS_QUERY_KEY });
    },
  });
}

export interface UpdateMediaAssetVars {
  id: string;
  alt?: string;
  altAr?: string;
  folder?: string;
  tags?: string[];
}

export function useUpdateMediaAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateMediaAssetVars) =>
      apiRequest(`/admin/content/media/${id}`, AdminMediaAssetResponse, { method: 'PATCH', body }).then((r) => r.asset),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MEDIA_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: MEDIA_FOLDERS_QUERY_KEY });
    },
  });
}

export interface BulkUpdateEntry {
  id: string;
  alt?: string;
  altAr?: string;
  folder?: string;
  tags?: string[];
}

/** plan.md §11.1's "alt-text bulk edit" — one round trip for N assets. */
export function useBulkUpdateMediaAssetsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: BulkUpdateEntry[]) =>
      apiRequest(
        '/admin/content/media/bulk',
        z.object({ assets: z.array(MediaAsset) }),
        { method: 'PATCH', body: { updates } },
      ).then((r) => r.assets),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MEDIA_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: MEDIA_FOLDERS_QUERY_KEY });
    },
  });
}

export function useDeleteMediaAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/content/media/${id}`, z.object({}), { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MEDIA_QUERY_KEY }),
  });
}
