import { z } from 'zod';
import { LoginInput, RegisterInput, User, UserRole } from '@lulwah/contracts';

/**
 * Request/response DTOs for `identity`. `RegisterInput`/`LoginInput`/
 * `User` are already defined in `@lulwah/contracts` (plan.md §9.3, §7.1)
 * — re-exported here rather than redefined, per the brief's "import
 * shared types from `@lulwah/contracts`, don't redefine them." Everything
 * below is either identity-module-only (no other workstream needs it) or
 * a response envelope's `data` shape, which does belong local to the
 * module that produces it.
 */
export { RegisterInput, LoginInput };

export const RegisterResponse = z.object({ user: User });
export type RegisterResponse = z.infer<typeof RegisterResponse>;

export const AuthSessionResponse = z.object({ user: User, accessToken: z.string() });
export type AuthSessionResponse = z.infer<typeof AuthSessionResponse>;

export const MeResponse = User;
export type MeResponse = z.infer<typeof MeResponse>;

/** `GET /admin/users` — offset pagination is fine for an admin table
 *  (plan.md §9.8: "cursor-based on hot lists ... offset allowed in admin
 *  tables"). */
export const AdminListUsersQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminListUsersQuery = z.infer<typeof AdminListUsersQuery>;

export const AdminListUsersResponse = z.object({ users: z.array(User) });
export type AdminListUsersResponse = z.infer<typeof AdminListUsersResponse>;

/** `PATCH /admin/users/:id/role` — the RBAC-matrix demonstration route
 *  (plan.md §10.2), guarded by `requirePermission('users.write')` at the
 *  route AND re-checked inside `identity.service.ts` itself. */
export const UpdateUserRoleInput = z.object({ role: UserRole });
export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleInput>;

export const UpdateUserRoleResponse = z.object({ user: User });
export type UpdateUserRoleResponse = z.infer<typeof UpdateUserRoleResponse>;
