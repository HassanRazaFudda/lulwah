import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { UserRole } from '@lulwah/contracts';

/**
 * Mongoose schemas for the `identity` module — plan.md §7.1 (`users`) and
 * §10.1 (`sessions` = refresh tokens). This is the ONLY file in the
 * module allowed to touch a Mongoose `Schema`/`model` (plan.md §5.4);
 * `identity.repository.ts` is the only file allowed to *query* them.
 *
 * Scope note: this skeleton implements auth, not the full customer
 * profile. Fields from §7.1 that only matter once other modules exist
 * (`defaultAddressId` needs `addresses`, `stats` needs `order`) are kept
 * as inert placeholders so the shape matches the plan, but nothing
 * writes to them yet.
 */

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export interface UserPhoneSubdoc {
  countryCode: '+971';
  number: string;
}

export interface UserMarketingSubdoc {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  consentAt: Date | null;
  consentIp: string | null;
}

export interface UserStatsSubdoc {
  orderCount: number;
  totalSpentFils: number;
  avgOrderValueFils: number;
  lastOrderAt: Date | null;
}

export interface UserDoc {
  _id: Types.ObjectId;
  email: string | null;
  emailVerifiedAt: Date | null;
  phone: UserPhoneSubdoc | null;
  phoneVerifiedAt: Date | null;
  passwordHash: string | null;
  provider: 'local' | 'google' | 'otp';
  googleId: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: string[];
  status: 'active' | 'suspended' | 'deleted';
  locale: 'en' | 'ar';
  currency: 'AED';
  defaultAddressId: Types.ObjectId | null;
  marketing: UserMarketingSubdoc;
  stats: UserStatsSubdoc;
  tags: string[];
  notesInternal: string;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, lowercase: true, trim: true, default: null },
    emailVerifiedAt: { type: Date, default: null },
    phone: {
      type: new Schema<UserPhoneSubdoc>(
        { countryCode: { type: String, enum: ['+971'], required: true }, number: { type: String, required: true } },
        { _id: false },
      ),
      default: null,
    },
    phoneVerifiedAt: { type: Date, default: null },
    passwordHash: { type: String, default: null },
    provider: { type: String, enum: ['local', 'google', 'otp'], required: true, default: 'local' },
    googleId: { type: String, default: null },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['customer', 'support', 'catalog', 'order_ops', 'warehouse', 'content', 'finance', 'manager', 'super_admin'],
      required: true,
      default: 'customer',
    },
    permissions: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'suspended', 'deleted'], required: true, default: 'active' },
    locale: { type: String, enum: ['en', 'ar'], required: true, default: 'en' },
    currency: { type: String, enum: ['AED'], required: true, default: 'AED' },
    defaultAddressId: { type: Schema.Types.ObjectId, ref: 'Address', default: null },
    marketing: {
      type: new Schema<UserMarketingSubdoc>(
        {
          email: { type: Boolean, default: false },
          sms: { type: Boolean, default: false },
          whatsapp: { type: Boolean, default: false },
          consentAt: { type: Date, default: null },
          consentIp: { type: String, default: null },
        },
        { _id: false },
      ),
      default: () => ({ email: false, sms: false, whatsapp: false, consentAt: null, consentIp: null }),
    },
    stats: {
      type: new Schema<UserStatsSubdoc>(
        {
          orderCount: { type: Number, default: 0 },
          totalSpentFils: { type: Number, default: 0 },
          avgOrderValueFils: { type: Number, default: 0 },
          lastOrderAt: { type: Date, default: null },
        },
        { _id: false },
      ),
      default: () => ({ orderCount: 0, totalSpentFils: 0, avgOrderValueFils: 0, lastOrderAt: null }),
    },
    tags: { type: [String], default: [] },
    notesInternal: { type: String, default: '' },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true, collection: 'users' },
);

// plan.md §7.1 index list.
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ 'phone.number': 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ createdAt: -1 });

export type UserHydratedDoc = HydratedDocument<UserDoc>;
export const UserModel = model<UserDoc>('User', userSchema);

// ---------------------------------------------------------------------------
// Session (refresh tokens) — plan.md §10.1
// ---------------------------------------------------------------------------

export type SessionRevokedReason = 'rotated' | 'logout' | 'logout_all' | 'reuse_detected';

export interface SessionDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** Shared by every token in one rotation chain — the unit reuse
   *  detection revokes (plan.md §10.1). */
  family: string;
  /** sha256 of the opaque refresh token's secret half. The raw secret is
   *  never persisted (plan.md: "only its hash stored in `sessions`"). */
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: SessionRevokedReason | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
}

const sessionSchema = new Schema<SessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    family: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, enum: ['rotated', 'logout', 'logout_all', 'reuse_detected'], default: null },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'sessions' },
);

sessionSchema.index({ userId: 1 });
sessionSchema.index({ family: 1 });
// TTL: purge a session's record once its refresh token would have expired
// anyway (30 days). Reuse detection only needs the record to survive
// until then, never longer.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionHydratedDoc = HydratedDocument<SessionDoc>;
export const SessionModel = model<SessionDoc>('Session', sessionSchema);

// ---------------------------------------------------------------------------
// Otp — stub schema only. plan.md §10.1 describes the real rules (6
// digits, hashed, 10-min TTL, 3 attempts, 60s resend cooldown, per-phone
// daily cap); the `/auth/otp/*` routes return 501 in this skeleton, so
// nothing writes to this collection yet.
// ---------------------------------------------------------------------------

export interface OtpDoc {
  _id: Types.ObjectId;
  identifier: string;
  purpose: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
}

const otpSchema = new Schema<OtpDoc>(
  {
    identifier: { type: String, required: true },
    purpose: { type: String, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'otps' },
);

otpSchema.index({ identifier: 1, purpose: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpModel = model<OtpDoc>('Otp', otpSchema);
