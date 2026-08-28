import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { HomeSection, HomeSectionType } from '@lulwah/contracts';
import { apiRequest } from '../api-client';

/**
 * Home-sections data-fetching layer — `GET/POST/PATCH/DELETE
 * /admin/content/home-sections*` plus the dedicated
 * `POST /admin/content/home-sections/reorder` (plan.md §11.1's homepage
 * builder, `apps/api/src/modules/content/home-section.routes.ts`). Same
 * `use*Query`/`use*Mutation` shape `queries/orders.ts` establishes.
 *
 * `HomeSection.settings` is a loose `Record<string, unknown>` on the wire
 * (see that field's own doc comment in `@lulwah/contracts`' `content.ts` —
 * Zod can't key a field's schema off a sibling's runtime value), so this
 * file does the same: the per-type typed sub-forms
 * (`components/content/home-section-forms/*`) are what actually constrain
 * `settings`' shape client-side, matching each of the 9
 * `HOME_SECTION_SETTINGS_SCHEMAS` entries; the server re-validates for
 * real via the discriminated `AdminCreateHomeSectionInput` / the update
 * path's per-type lookup.
 */

const AdminHomeSectionListResponse = z.object({ sections: z.array(HomeSection) });
const AdminHomeSectionResponse = z.object({ section: HomeSection });

const HOME_SECTIONS_QUERY_KEY = ['admin', 'content', 'home-sections'] as const;

export function useAdminHomeSectionsQuery() {
  return useQuery({
    queryKey: HOME_SECTIONS_QUERY_KEY,
    queryFn: () => apiRequest('/admin/content/home-sections', AdminHomeSectionListResponse).then((r) => r.sections),
  });
}

export interface HomeSectionDraft {
  type: HomeSectionType;
  settings: Record<string, unknown>;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export function useCreateHomeSectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: HomeSectionDraft) =>
      apiRequest('/admin/content/home-sections', AdminHomeSectionResponse, { method: 'POST', body: draft }).then(
        (r) => r.section,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: HOME_SECTIONS_QUERY_KEY }),
  });
}

export interface UpdateHomeSectionVars {
  id: string;
  draft: HomeSectionDraft;
}

export function useUpdateHomeSectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draft }: UpdateHomeSectionVars) =>
      apiRequest(`/admin/content/home-sections/${id}`, AdminHomeSectionResponse, { method: 'PATCH', body: draft }).then(
        (r) => r.section,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: HOME_SECTIONS_QUERY_KEY }),
  });
}

interface ToggleHomeSectionActiveContext {
  previous: HomeSection[] | undefined;
}

/** Used for the isActive toggle too — a single-field PATCH through the
 *  same partial-update endpoint the full settings form uses. */
export function useToggleHomeSectionActiveMutation() {
  const queryClient = useQueryClient();
  return useMutation<HomeSection, Error, { id: string; isActive: boolean }, ToggleHomeSectionActiveContext>({
    mutationFn: ({ id, isActive }) =>
      apiRequest(`/admin/content/home-sections/${id}`, AdminHomeSectionResponse, {
        method: 'PATCH',
        body: { isActive },
      }).then((r) => r.section),
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: HOME_SECTIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<HomeSection[]>(HOME_SECTIONS_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<HomeSection[]>(
          HOME_SECTIONS_QUERY_KEY,
          previous.map((s) => (s.id === id ? { ...s, isActive } : s)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(HOME_SECTIONS_QUERY_KEY, context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: HOME_SECTIONS_QUERY_KEY }),
  });
}

export function useDeleteHomeSectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/content/home-sections/${id}`, z.object({}), { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: HOME_SECTIONS_QUERY_KEY }),
  });
}

/**
 * `POST /admin/content/home-sections/reorder` — optimistic, matching
 * plan.md §11.2 rule 2 ("optimistic updates on toggles and inline edits,
 * with rollback + toast on failure"): the drag interaction itself must
 * feel instant, so the list is reordered in the cache immediately and
 * rolled back if the server rejects it.
 */
export interface ReorderContext {
  previous: HomeSection[] | undefined;
}

export function useReorderHomeSectionsMutation() {
  const queryClient = useQueryClient();
  return useMutation<HomeSection[], Error, string[], ReorderContext>({
    mutationFn: (orderedIds: string[]) =>
      apiRequest('/admin/content/home-sections/reorder', AdminHomeSectionListResponse, {
        method: 'POST',
        body: { orderedIds },
      }).then((r) => r.sections),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: HOME_SECTIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<HomeSection[]>(HOME_SECTIONS_QUERY_KEY);
      if (previous) {
        const byId = new Map(previous.map((s) => [s.id, s]));
        const reordered = orderedIds.map((id) => byId.get(id)).filter((s): s is HomeSection => Boolean(s));
        queryClient.setQueryData<HomeSection[]>(HOME_SECTIONS_QUERY_KEY, reordered);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(HOME_SECTIONS_QUERY_KEY, context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: HOME_SECTIONS_QUERY_KEY }),
  });
}
