import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Banner, BannerPlacement, MediaRef } from '@lulwah/contracts';
import { apiRequest } from '../api-client';

/**
 * Banners data-fetching layer — `GET/POST/PATCH/DELETE
 * /admin/content/banners*` (plan.md §11.1: "desktop/mobile assets and
 * scheduling"). Same shape as `content-home-sections.ts`.
 */

const AdminBannerListResponse = z.object({ banners: z.array(Banner) });
const AdminBannerResponse = z.object({ banner: Banner });

const BANNERS_QUERY_KEY = ['admin', 'content', 'banners'] as const;

export function useAdminBannersQuery() {
  return useQuery({
    queryKey: BANNERS_QUERY_KEY,
    queryFn: () => apiRequest('/admin/content/banners', AdminBannerListResponse).then((r) => r.banners),
  });
}

export interface BannerDraft {
  placement: BannerPlacement;
  mediaDesktop: MediaRef | null;
  mediaMobile: MediaRef | null;
  link: string | null;
  textEn: string;
  textAr: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
}

export function useCreateBannerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: BannerDraft) =>
      apiRequest('/admin/content/banners', AdminBannerResponse, { method: 'POST', body: draft }).then((r) => r.banner),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: BANNERS_QUERY_KEY }),
  });
}

export interface UpdateBannerVars {
  id: string;
  draft: Partial<BannerDraft>;
}

export function useUpdateBannerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draft }: UpdateBannerVars) =>
      apiRequest(`/admin/content/banners/${id}`, AdminBannerResponse, { method: 'PATCH', body: draft }).then(
        (r) => r.banner,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: BANNERS_QUERY_KEY }),
  });
}

interface ToggleBannerActiveContext {
  previous: Banner[] | undefined;
}

/** Optimistic isActive toggle — plan.md §11.2 rule 2. */
export function useToggleBannerActiveMutation() {
  const queryClient = useQueryClient();
  return useMutation<Banner, Error, { id: string; isActive: boolean }, ToggleBannerActiveContext>({
    mutationFn: ({ id, isActive }) =>
      apiRequest(`/admin/content/banners/${id}`, AdminBannerResponse, { method: 'PATCH', body: { isActive } }).then(
        (r) => r.banner,
      ),
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: BANNERS_QUERY_KEY });
      const previous = queryClient.getQueryData<Banner[]>(BANNERS_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<Banner[]>(
          BANNERS_QUERY_KEY,
          previous.map((b) => (b.id === id ? { ...b, isActive } : b)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(BANNERS_QUERY_KEY, context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: BANNERS_QUERY_KEY }),
  });
}

export function useDeleteBannerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/content/banners/${id}`, z.object({}), { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: BANNERS_QUERY_KEY }),
  });
}
