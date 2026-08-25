import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * Mongoose schema for `cod_otps` — `payment`'s `CodGateway`. Same shape
 * `identity.model.ts`'s (currently-unused, `/auth/otp/*` returns 501)
 * `OtpModel` documents for its own future use — "6 digits, hashed, 10-min
 * TTL, 3 attempts" (plan.md §10.1's OTP pattern, applied here to COD
 * checkout verification instead of login). Owned by `payment`, not
 * `identity`: plan.md §5.3's cross-module rule is "call the other module's
 * exported service function," and `identity` doesn't expose one for OTP
 * (its own OTP routes are stubs) — reaching into its Mongoose model
 * directly would violate that rule even harder than not reusing the
 * pattern at all. A narrow, deliberate divergence — see `payment` module's
 * report.
 */
export interface CodOtpDoc {
  _id: Types.ObjectId;
  /** `checkout`'s `CheckoutSession.sessionId` — a uuid (the external key
   *  every checkout endpoint addresses a session by, per `checkout.model
   *  .ts`), NOT that document's Mongo `_id`. A plain, unindexed-as-ObjectId
   *  string field for exactly that reason. */
  checkoutSessionId: string;
  phone: string;
  codeHash: string;
  attempts: number;
  verifiedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

const codOtpSchema = new Schema<CodOtpDoc>(
  {
    checkoutSessionId: { type: String, required: true },
    phone: { type: String, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    verifiedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'cod_otps' },
);

codOtpSchema.index({ checkoutSessionId: 1, createdAt: -1 });
codOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type CodOtpHydratedDoc = HydratedDocument<CodOtpDoc>;
export const CodOtpModel = model<CodOtpDoc>('CodOtp', codOtpSchema);
