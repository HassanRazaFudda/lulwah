import { z } from 'zod';
import { LoginInput, objectId, RegisterInput, User, UserPhone, UserRole } from '@lulwah/contracts';

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

/**
 * `POST /admin/users/invite` — plan.md §11.1's "Invite staff." No
 * self-serve registration exists for staff (unlike customers via
 * `RegisterInput`/`POST /auth/register`) — an admin creates the account
 * directly with a role attached. `role` is validated to exclude
 * `'customer'` in the service layer (`identity.service.ts
 * #inviteStaffUser`), not here, so the rejection is a clear
 * `VALIDATION_FAILED` `AppError` with a specific message rather than a
 * generic Zod parse failure.
 */
export const InviteStaffInput = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: UserPhone,
  role: UserRole,
});
export type InviteStaffInput = z.infer<typeof InviteStaffInput>;

/** `temporaryPassword` is the one-time plaintext value the inviting admin
 *  must copy down and hand to the new hire out of band — there is no
 *  emailing infrastructure to deliver it any other way (plan.md §22,
 *  `shared/notify.ts`'s own doc comment), and it is never persisted or
 *  logged anywhere after this single response (only its argon2 hash is
 *  stored, via the same `hashPassword` helper `register` uses). */
export const InviteStaffResponse = z.object({ user: User, temporaryPassword: z.string() });
export type InviteStaffResponse = z.infer<typeof InviteStaffResponse>;

/**
 * `PATCH /admin/users/:id/status` — plan.md §11.1's "deactivate." Only
 * `active`/`suspended` are reachable through this endpoint — `'deleted'`
 * (the third value `@lulwah/contracts`' `UserStatus` allows) is a more
 * irreversible, separate concern this task didn't build, so it's excluded
 * from this input's own enum rather than merely undocumented.
 */
export const UpdateUserStatusInput = z.object({ status: z.enum(['active', 'suspended']) });
export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusInput>;

export const UpdateUserStatusResponse = z.object({ user: User });
export type UpdateUserStatusResponse = z.infer<typeof UpdateUserStatusResponse>;

/**
 * `GET /admin/users/:id/sessions` / `POST .../sessions/:sessionId/revoke`
 * — plan.md §11.1's "session list with revoke." A module-local response
 * shape (no other consumer needs it, same "local DTO" precedent this
 * file's own top comment sets) over the real `sessions` collection plan.md
 * §10.1 already describes as "rotated every use, family-tagged" — see
 * `identity.repository.ts#findActiveSessionsForUser`'s doc comment for
 * exactly what "one active session" means against a rotating-token store.
 */
export const AdminSessionSummary = z.object({
  id: objectId,
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
});
export type AdminSessionSummary = z.infer<typeof AdminSessionSummary>;

export const AdminListUserSessionsResponse = z.object({ sessions: z.array(AdminSessionSummary) });
export type AdminListUserSessionsResponse = z.infer<typeof AdminListUserSessionsResponse>;
