import { CodOtpModel } from './cod-otp.model.js';
import type { CodOtpHydratedDoc } from './cod-otp.model.js';

/** The ONLY file allowed to touch `CodOtpModel` (plan.md §5.4). */

export async function createOtp(input: { checkoutSessionId: string; phone: string; codeHash: string; expiresAt: Date }): Promise<CodOtpHydratedDoc> {
  return CodOtpModel.create({ checkoutSessionId: input.checkoutSessionId, phone: input.phone, codeHash: input.codeHash, expiresAt: input.expiresAt, attempts: 0, verifiedAt: null });
}

/** Most recent OTP issued for a session — `verifyOtp` always checks
 *  against the latest one (a fresh `requestOtp` implicitly supersedes any
 *  earlier code, rather than tracking a separate invalidation step). */
export async function findLatestOtp(checkoutSessionId: string): Promise<CodOtpHydratedDoc | null> {
  return CodOtpModel.findOne({ checkoutSessionId }).sort({ createdAt: -1 }).exec();
}

export async function incrementAttempts(id: string): Promise<CodOtpHydratedDoc | null> {
  return CodOtpModel.findOneAndUpdate({ _id: id }, { $inc: { attempts: 1 } }, { returnDocument: 'after' }).exec();
}

export async function markVerified(id: string): Promise<CodOtpHydratedDoc | null> {
  return CodOtpModel.findOneAndUpdate({ _id: id }, { verifiedAt: new Date() }, { returnDocument: 'after' }).exec();
}
