import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Lookbook, LookbookStatus, MediaRef, PageSeo } from '@lulwah/contracts';
import { apiRequest } from '../api-client';
import { buildQueryString } from './query-utils';

/**
 * Lookbooks data-fetching layer — `GET/POST/PATCH/DELETE
 * /admin/content/lookbooks*` (`apps/api/src/modules/content/lookbook.dto.ts`
 * — read directly, not guessed). Same shape as `content-pages.ts` (`Page`
 * is the closest structural match: slug, bilingual title, sanitized HTML
 * body, SEO, draft/published status — see `LookbooksPanel.tsx`'s doc
 * comment), extended with the fields `Lookbook` declares on top of that:
 * `heroMedia`/`heroMediaMobile`, an ordered `gallery: MediaRef[]`, and an
 * optional "shop this look" `collectionId`.
 */

const AdminLookbookListResponse = z.object({ lookbooks: z.array(Lookbook) });
const AdminLookbookResponse = z.object({ lookbook: Lookbook });

const LOOKBOOKS_QUERY_KEY = ['admin', 'content', 'lookbooks'] as const;

export function useAdminLookbooksQuery(status?: LookbookStatus) {
  return useQuery({
    queryKey: [...LOOKBOOKS_QUERY_KEY, status ?? 'all'],
    queryFn: () =>
      apiRequest(`/admin/content/lookbooks${buildQueryString({ status, limit: 100 })}`, AdminLookbookListResponse).then(
        (r) => r.lookbooks,
      ),
  });
}

export interface LookbookDraft {
  slug: string;
  titleEn: string;
  titleAr: string;
  heroMedia: MediaRef | null;
  heroMediaMobile: MediaRef | null;
  gallery: MediaRef[];
  bodyEn: string;
  bodyAr: string;
  collectionId: string | null;
  status: LookbookStatus;
  seo: PageSeo;
  sortOrder: number;
}

export function useCreateLookbookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: LookbookDraft) =>
      apiRequest('/admin/content/lookbooks', AdminLookbookResponse, { method: 'POST', body: draft }).then(
        (r) => r.lookbook,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: LOOKBOOKS_QUERY_KEY }),
  });
}

export interface UpdateLookbookVars {
  id: string;
  draft: Partial<LookbookDraft>;
}

export function useUpdateLookbookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draft }: UpdateLookbookVars) =>
      apiRequest(`/admin/content/lookbooks/${id}`, AdminLookbookResponse, { method: 'PATCH', body: draft }).then(
        (r) => r.lookbook,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: LOOKBOOKS_QUERY_KEY }),
  });
}

export function useDeleteLookbookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/content/lookbooks/${id}`, z.object({}), { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: LOOKBOOKS_QUERY_KEY }),
  });
}

// Re-exported so `LookbooksPanel.tsx` has one import site for both its own
// collection picker and the read query/mutations above, mirroring
// `queries/collections.ts`'s own re-export of `catalog-refs.ts`'s list hook.
export { useAdminCollectionsQuery } from './catalog-refs';
