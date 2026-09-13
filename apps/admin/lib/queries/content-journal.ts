import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { JournalPost, JournalPostStatus, MediaRef, PageSeo } from '@lulwah/contracts';
import { apiRequest } from '../api-client';
import { buildQueryString } from './query-utils';

/**
 * Journal data-fetching layer — `GET/POST/PATCH/DELETE
 * /admin/content/journal*` (`apps/api/src/modules/content/journal.dto.ts`
 * — read directly, not guessed). Same real CRUD shape `content-pages.ts`
 * establishes (`Page` is the closest structural match), extended with
 * `coverMedia`/`excerptEn`/`excerptAr`/`publishedAt` on top of that.
 */

const AdminJournalPostListResponse = z.object({ posts: z.array(JournalPost) });
const AdminJournalPostResponse = z.object({ post: JournalPost });

const JOURNAL_QUERY_KEY = ['admin', 'content', 'journal'] as const;

export function useAdminJournalPostsQuery(status?: JournalPostStatus) {
  return useQuery({
    queryKey: [...JOURNAL_QUERY_KEY, status ?? 'all'],
    queryFn: () =>
      apiRequest(`/admin/content/journal${buildQueryString({ status, limit: 100 })}`, AdminJournalPostListResponse).then(
        (r) => r.posts,
      ),
  });
}

export interface JournalPostDraft {
  slug: string;
  titleEn: string;
  titleAr: string;
  coverMedia: MediaRef | null;
  excerptEn: string;
  excerptAr: string;
  bodyEn: string;
  bodyAr: string;
  /** `datetime-local` input-value string, or `null` — mirrors
   *  `BannersPanel.tsx`'s own `startsAt`/`endsAt` round-trip precedent.
   *  `AdminCreateJournalPostInput.publishedAt` is `z.coerce.date().nullable()`
   *  server-side, which parses that string fine. */
  publishedAt: string | null;
  status: JournalPostStatus;
  seo: PageSeo;
}

export function useCreateJournalPostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: JournalPostDraft) =>
      apiRequest('/admin/content/journal', AdminJournalPostResponse, { method: 'POST', body: draft }).then((r) => r.post),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: JOURNAL_QUERY_KEY }),
  });
}

export interface UpdateJournalPostVars {
  id: string;
  draft: Partial<JournalPostDraft>;
}

export function useUpdateJournalPostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draft }: UpdateJournalPostVars) =>
      apiRequest(`/admin/content/journal/${id}`, AdminJournalPostResponse, { method: 'PATCH', body: draft }).then(
        (r) => r.post,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: JOURNAL_QUERY_KEY }),
  });
}

export function useDeleteJournalPostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/content/journal/${id}`, z.object({}), { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: JOURNAL_QUERY_KEY }),
  });
}
