import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { User, UserPhone, UserRole } from '@lulwah/contracts';
import { apiRequest } from '../api-client';

/**
 * Users & roles data-fetching layer — `GET/POST/PATCH /admin/users*`
 * (plan.md §9.7/§11.1/§10.2, `apps/api/src/modules/identity/identity
 * .routes.ts`). Same `use*Query`/`use*Mutation` + optimistic-with-rollback
 * shape `queries/orders.ts` already establishes.
 *
 * **Real, real, real, and honestly still not real — the current state of
 * plan.md §11.1's four Users & roles actions beyond list/role-change**:
 * invite staff, deactivate, and session-list-with-revoke are now real
 * endpoints (`POST /admin/users/invite`, `PATCH /admin/users/:id/status`,
 * `GET /admin/users/:id/sessions` + `POST .../sessions/:id/revoke`) — this
 * file has real mutations/queries for all three below. **Force 2FA reset
 * is still NOT built, deliberately**: no real TOTP/2FA system exists
 * anywhere in this codebase (the login page's TOTP field has never
 * verified against anything real), so there is nothing genuine to
 * "reset" — `UsersPage` still renders that one control as visibly
 * disabled, and this file still exposes no mutation for it.
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
const InviteStaffResponse = z.object({ user: User, temporaryPassword: z.string() });
const UpdateUserStatusResponse = z.object({ user: User });

const AdminSessionSummary = z.object({
  id: z.string(),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
});
export type AdminSessionSummary = z.infer<typeof AdminSessionSummary>;
const AdminListUserSessionsResponse = z.object({ sessions: z.array(AdminSessionSummary) });

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

// ---------------------------------------------------------------------------
// Invite staff — POST /admin/users/invite
// ---------------------------------------------------------------------------

export interface InviteStaffVars {
  email: string;
  firstName: string;
  lastName: string;
  phone: UserPhone;
  role: UserRole;
}

export interface InviteStaffResult {
  user: User;
  /** One-time plaintext value — the API never stores or logs it after
   *  this single response. `UsersPage` shows it once in a copyable panel
   *  and never persists it client-side beyond that render either. */
  temporaryPassword: string;
}

/** `POST /admin/users/invite` — plan.md §11.1 "Invite staff, assign
 *  role." No self-serve registration exists for staff, so this is the
 *  only way a new staff account is ever created. Not optimistic (unlike
 *  the role-change mutation) — there's no sensible "guess" for a
 *  not-yet-created user row, and the caller needs the real response to
 *  show the generated password. */
export function useInviteStaffMutation() {
  const queryClient = useQueryClient();

  return useMutation<InviteStaffResult, Error, InviteStaffVars>({
    mutationFn: (vars) => apiRequest('/admin/users/invite', InviteStaffResponse, { method: 'POST', body: vars }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// Deactivate / reactivate — PATCH /admin/users/:id/status
// ---------------------------------------------------------------------------

export interface UpdateUserStatusVars {
  userId: string;
  status: 'active' | 'suspended';
}

interface UpdateUserStatusContext {
  previous: User[] | undefined;
}

/** `PATCH /admin/users/:id/status` — plan.md §11.1 "deactivate." Same
 *  optimistic-with-rollback shape as the role-change mutation above;
 *  suspending also revokes the target's sessions server-side
 *  (`identity.service.ts#updateUserStatusAsAdmin`), which this mutation
 *  doesn't need to know about — it only reflects the `status` field. */
export function useUpdateUserStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, UpdateUserStatusVars, UpdateUserStatusContext>({
    mutationFn: ({ userId, status }) =>
      apiRequest(`/admin/users/${userId}/status`, UpdateUserStatusResponse, {
        method: 'PATCH',
        body: { status },
      }).then((r) => r.user),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: USERS_QUERY_KEY });
      const previous = queryClient.getQueryData<User[]>(USERS_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<User[]>(
          USERS_QUERY_KEY,
          previous.map((u) => (u.id === vars.userId ? { ...u, status: vars.status } : u)),
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

// ---------------------------------------------------------------------------
// Session list + revoke — GET /admin/users/:id/sessions,
// POST /admin/users/:id/sessions/:sessionId/revoke
// ---------------------------------------------------------------------------

/** Fetched on demand (only while a given user's Sessions panel is open —
 *  `enabled` gates that), not prefetched for every row: it's per-user
 *  detail, the same "don't fetch what isn't visible" posture
 *  `queries/orders.ts`'s detail-only fields already follow. */
export function useUserSessionsQuery(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'users', userId, 'sessions'] as const,
    queryFn: () => apiRequest(`/admin/users/${userId}/sessions`, AdminListUserSessionsResponse).then((r) => r.sessions),
    enabled: userId !== null,
  });
}

export interface RevokeSessionVars {
  userId: string;
  sessionId: string;
}

/** `POST /admin/users/:id/sessions/:sessionId/revoke` — plan.md §11.1
 *  "with revoke." Not optimistic — a session either really is revoked
 *  server-side or the request failed outright, and the list is small
 *  enough that a plain refetch is instant. */
export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, sessionId }: RevokeSessionVars) =>
      apiRequest(`/admin/users/${userId}/sessions/${sessionId}/revoke`, z.object({}), { method: 'POST', body: {} }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users', vars.userId, 'sessions'] });
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
