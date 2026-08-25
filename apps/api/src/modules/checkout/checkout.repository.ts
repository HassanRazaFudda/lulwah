import { CheckoutSessionModel } from './checkout.model.js';
import type { CheckoutSessionHydratedDoc } from './checkout.model.js';

/** The ONLY file allowed to touch `CheckoutSessionModel` (plan.md §5.4). */

export async function createSession(input: { cartId: string; userId: string | null; guestEmail: string | null; expiresAt: Date }): Promise<CheckoutSessionHydratedDoc> {
  return CheckoutSessionModel.create({ cartId: input.cartId, userId: input.userId, guestEmail: input.guestEmail, expiresAt: input.expiresAt, status: 'open' });
}

export async function findOpenSessionBySessionId(sessionId: string): Promise<CheckoutSessionHydratedDoc | null> {
  return CheckoutSessionModel.findOne({ sessionId, status: 'open' }).exec();
}

export async function save(doc: CheckoutSessionHydratedDoc): Promise<CheckoutSessionHydratedDoc> {
  return doc.save();
}

export async function markCompleted(sessionId: string, orderId: string): Promise<void> {
  await CheckoutSessionModel.updateOne({ sessionId }, { status: 'completed', orderId }).exec();
}
