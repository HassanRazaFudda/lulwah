import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { User, UserRole } from '@lulwah/contracts';
import { apiRequest } from '../api-client';

/**
 * Users & roles data-fetching layer — `GET/PATCH /admin/users*` (plan.md
 * §9.7/§11.1/§10.2, `apps/api/src/modules/identity/identity.routes.ts`).
 * Same `use*Query`/`use*Mutation` + optimistic-with-rollback shape
 * `queries/orders.ts` already establishes.
 *
 * **A real, currently-missing gap, stated plainly (not worked around)**:
 * `identity.routes.ts` only has two admin routes —
 * `GET /admin/users` (list) and `PATCH /admin/users/:id/role` (role
 * change). There is NO invite endpoint, NO 2FA-reset endpoint, NO
 * deactivate endpoint, and NO session-list/revoke endpoint anywhere in
 * this codebase — confirmed by reading the whole file, not assumed from
 * the screen name. `UsersPage` renders those controls as visibly disabled
 * ("coming soon") rather than omitting them entirely, so the gap is
 * legible in the UI itself, and this file exposes no mutation for any of
 * them — there is nothing here a button could wire up to even by mistake.
 *
 * `AdminListUsersQuery` (`identity.dto.ts`) is plain offset pagination —
 * `page`/`limit` only, no `role`/`search` server-side filter — and,
 * verified by reading `identity.repository.ts#findUsersPage`, the query
 * behind it has no `role` filter either: it returns every `User` document,
 * customer accounts included, not just staff. `UsersPage`'s role filter is
 * therefore client-side over one fetched page, the same "fetch one
 * generous page, filter in memory" precedent `queries/products.ts` already
 * sets for a filter its own endpoint doesn't support server-side.
 */

const AdminUsersListResponse = z.object({ users: z.array(User) });
const UpdateUserRoleResponse = z.object({ user: User });

const USERS_QUERY_KEY = ['admin', 'users'] as const;

export function useAdminUsersQuery() {
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: () => apiRequest('/admin/users?limit=100', AdminUsersListResponse).then((r) => r.users),
  });
}

export interface UpdateUserRoleVars {
  userId: string;
  role: UserRole;
}

interface UpdateUserRoleContext {
  previous: User[] | undefined;
}

/**
 * `PATCH /admin/users/:id/role` — plan.md §10.2's RBAC-matrix
 * demonstration route. Optimistic (plan.md §11.2 rule 2), rolled back on
 * failure; `UsersPage` gates the actual submit behind a typed
 * confirmation (rule 3 — "every destructive action needs typed
 * confirmation for irreversible ones," and a role change is exactly that
 * kind of meaningful permission change) before this mutation is ever
 * called, so by the time `mutate` runs the action has already been
 * deliberately confirmed once.
 */
export function useUpdateUserRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, UpdateUserRoleVars, UpdateUserRoleContext>({
    mutationFn: ({ userId, role }) =>
      apiRequest(`/admin/users/${userId}/role`, UpdateUserRoleResponse, {
        method: 'PATCH',
        body: { role },
      }).then((r) => r.user),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: USERS_QUERY_KEY });
      const previous = queryClient.getQueryData<User[]>(USERS_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<User[]>(
          USERS_QUERY_KEY,
          previous.map((u) => (u.id === vars.userId ? { ...u, role: vars.role } : u)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(USERS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

/** Display labels for `@lulwah/contracts`' `UserRole` enum, matching
 *  plan.md §10.2's RBAC matrix row names exactly. */
export const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Customer',
  support: 'Support',
  catalog: 'Catalog',
  order_ops: 'Order ops',
  warehouse: 'Warehouse',
  content: 'Content',
  finance: 'Finance',
  manager: 'Manager',
  super_admin: 'Super admin',
};

/** Staff roles only — every `UserRole` value except `customer` (storefront
 *  self-service accounts are never assigned a staff role). Used to build
 *  the role `<select>` options for the change-role control; `customer`
 *  itself is still a selectable filter value in the list view above. */
export const STAFF_ROLES: readonly UserRole[] = UserRole.options.filter((r) => r !== 'customer');
