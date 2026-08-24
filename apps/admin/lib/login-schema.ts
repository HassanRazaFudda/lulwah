import { LoginInput } from '@lulwah/contracts';

/**
 * Admin login form — reuses `@lulwah/contracts`' `LoginInput` (`email` +
 * `password`) directly rather than a hand-rolled duplicate, now that
 * `apps/api`'s real `POST /auth/login` (plan.md §9.3) exists and defines
 * that shape. The original version of this file collected a mandatory
 * `totpCode` per plan.md §10.1's "mandatory TOTP 2FA" spec, but the shipped
 * `identity` module (see `docs/implemented-plan.md` §4.1) has no TOTP
 * verification at all — `LoginInput` never had a `totpCode` field, and
 * sending one would just be silently ignored. Collecting a field the API
 * can't check would be worse than not collecting it (a false sense of
 * security), so it's dropped until TOTP is actually built.
 */
export const AdminLoginFormValues = LoginInput;
export type AdminLoginFormValues = LoginInput;
