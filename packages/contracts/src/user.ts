import { z } from 'zod';
import { objectId } from './common.js';
import { UserRole } from './enums.js';
import { Fils } from './money.js';

/**
 * User — plan.md §7.1. Security-sensitive/staff-only fields
 * (`passwordHash`, `googleId`, `notesInternal`, `lastLoginIp`,
 * `failedLoginCount`, `lockedUntil`) are intentionally left out of this
 * shared contract — they must never round-trip to the storefront or admin
 * client, so they belong on the Mongoose model / an admin-only DTO in the
 * API workstream, not here.
 */

export const UserProvider = z.enum(['local', 'google', 'otp']);
export type UserProvider = z.infer<typeof UserProvider>;

export const UserStatus = z.enum(['active', 'suspended', 'deleted']);
export type UserStatus = z.infer<typeof UserStatus>;

/** UAE mobile number: `+971` plus a 9-digit subscriber number starting with 5. */
export const UserPhone = z.object({
  countryCode: z.literal('+971'),
  number: z.string().regex(/^5\d{8}$/, 'UAE mobile numbers are 9 digits starting with 5'),
});
export type UserPhone = z.infer<typeof UserPhone>;

export const UserMarketingPrefs = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  whatsapp: z.boolean(),
  consentAt: z.coerce.date().nullable(),
  consentIp: z.string(),
});
export type UserMarketingPrefs = z.infer<typeof UserMarketingPrefs>;

export const UserStats = z.object({
  orderCount: z.number().int().nonnegative(),
  totalSpentFils: Fils,
  avgOrderValueFils: Fils,
  lastOrderAt: z.coerce.date().nullable(),
});
export type UserStats = z.infer<typeof UserStats>;

export const User = z.object({
  id: objectId,
  email: z.string().email().nullable(),
  emailVerifiedAt: z.coerce.date().nullable(),
  phone: UserPhone.nullable(),
  phoneVerifiedAt: z.coerce.date().nullable(),
  provider: UserProvider,
  firstName: z.string(),
  lastName: z.string(),
  role: UserRole,
  permissions: z.array(z.string()), // extra grants beyond `role` — §10.2 RBAC matrix
  status: UserStatus,
  locale: z.enum(['en', 'ar']),
  currency: z.literal('AED'),
  defaultAddressId: objectId.nullable(),
  marketing: UserMarketingPrefs,
  stats: UserStats,
  tags: z.array(z.string()), // 'vip', 'wholesale', 'risky_cod'
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof User>;

/** plan.md §9.3 `POST /auth/register`. */
export const RegisterInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: UserPhone,
});
export type RegisterInput = z.infer<typeof RegisterInput>;

/** plan.md §9.3 `POST /auth/login`. */
export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;
