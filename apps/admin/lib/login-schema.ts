import { z } from 'zod';

/**
 * Admin login form — plan.md §10.1: "Admin accounts: mandatory TOTP 2FA,
 * 8-hour session, separate cookie domain (admin.lulwah.ae), IP-change
 * re-auth." The form collects the 6-digit authenticator code in the same
 * step as email/password rather than a second screen.
 *
 * This is client-side validation shape only. The real request/response
 * contracts for `POST /auth/login` and the 2FA verify step belong in
 * `packages/contracts` once `apps/api` defines them (a separate,
 * in-progress workstream) — out of scope here per the task brief.
 */
export const AdminLoginFormValues = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  totpCode: z
    .string()
    .min(1, 'Enter your 6-digit authenticator code')
    .regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
});
export type AdminLoginFormValues = z.infer<typeof AdminLoginFormValues>;
