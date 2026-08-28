import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Page, PageSeo, PageStatus } from '@lulwah/contracts';
import { apiRequest } from '../api-client';
import { buildQueryString } from './query-utils';

/**
 * Pages data-fetching layer — `GET/POST/PATCH/DELETE /admin/content/pages*`
 * (plan.md §11.1: "rich text EN/AR"). `bodyEn`/`bodyAr` are sanitized HTML
 * server-side (`content` module's `sanitize.ts`) — see
 * `components/content/PagesPanel.tsx`'s doc comment on why the editor here
 * is a plain textarea, not a WYSIWYG.
 */

const AdminPageListResponse = z.object({ pages: z.array(Page) });
const AdminPageResponse = z.object({ page: Page });

const PAGES_QUERY_KEY = ['admin', 'content', 'pages'] as const;

export function useAdminPagesQuery(status?: PageStatus) {
  return useQuery({
    queryKey: [...PAGES_QUERY_KEY, status ?? 'all'],
    queryFn: () =>
      apiRequest(`/admin/content/pages${buildQueryString({ status, limit: 100 })}`, AdminPageListResponse).then(
        (r) => r.pages,
      ),
  });
}

export interface PageDraft {
  slug: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  status: PageStatus;
  seo: PageSeo;
}

export function useCreatePageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: PageDraft) =>
      apiRequest('/admin/content/pages', AdminPageResponse, { method: 'POST', body: draft }).then((r) => r.page),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PAGES_QUERY_KEY }),
  });
}

export interface UpdatePageVars {
  id: string;
  draft: Partial<PageDraft>;
}

export function useUpdatePageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draft }: UpdatePageVars) =>
      apiRequest(`/admin/content/pages/${id}`, AdminPageResponse, { method: 'PATCH', body: draft }).then((r) => r.page),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PAGES_QUERY_KEY }),
  });
}

export function useDeletePageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/content/pages/${id}`, z.object({}), { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PAGES_QUERY_KEY }),
  });
}
