import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Menu, MenuLocation } from '@lulwah/contracts';
import type { MenuItemNode } from '@lulwah/contracts';
import { apiRequest } from '../api-client';

/**
 * Menus data-fetching layer — `GET/POST/PATCH/DELETE /admin/content/menus*`
 * (plan.md §11.1: "nested drag-and-drop with featured imagery per column").
 * `location` is the menu's own lookup key and is not editable via PATCH
 * (`AdminUpdateMenuInput` omits it — see that DTO's own comment); creating
 * a menu for a not-yet-used `MenuLocation` is the only way to add one.
 */

const AdminMenuListResponse = z.object({ menus: z.array(Menu) });
const AdminMenuResponse = z.object({ menu: Menu });

const MENUS_QUERY_KEY = ['admin', 'content', 'menus'] as const;

export function useAdminMenusQuery() {
  return useQuery({
    queryKey: MENUS_QUERY_KEY,
    queryFn: () => apiRequest('/admin/content/menus', AdminMenuListResponse).then((r) => r.menus),
  });
}

export function useCreateMenuMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (location: MenuLocation) =>
      apiRequest('/admin/content/menus', AdminMenuResponse, { method: 'POST', body: { location, items: [] } }).then(
        (r) => r.menu,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MENUS_QUERY_KEY }),
  });
}

export interface UpdateMenuVars {
  id: string;
  items?: MenuItemNode[];
  isActive?: boolean;
}

interface UpdateMenuContext {
  previous: Menu[] | undefined;
}

/** Also used for item add/remove/reorder/nest — every one of those is a
 *  whole-`items[]` PATCH (there's no per-node endpoint), same as
 *  `MenuItem`'s own recursive shape on the wire (`z.lazy()` — see
 *  `@lulwah/contracts`' `content.ts`). */
export function useUpdateMenuMutation() {
  const queryClient = useQueryClient();
  return useMutation<Menu, Error, UpdateMenuVars, UpdateMenuContext>({
    mutationFn: ({ id, items, isActive }) =>
      apiRequest(`/admin/content/menus/${id}`, AdminMenuResponse, {
        method: 'PATCH',
        body: { items, isActive },
      }).then((r) => r.menu),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: MENUS_QUERY_KEY });
      const previous = queryClient.getQueryData<Menu[]>(MENUS_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<Menu[]>(
          MENUS_QUERY_KEY,
          previous.map((m) =>
            m.id === vars.id
              ? {
                  ...m,
                  items: vars.items ?? m.items,
                  isActive: vars.isActive ?? m.isActive,
                }
              : m,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(MENUS_QUERY_KEY, context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: MENUS_QUERY_KEY }),
  });
}

export function useDeleteMenuMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/content/menus/${id}`, z.object({}), { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MENUS_QUERY_KEY }),
  });
}
