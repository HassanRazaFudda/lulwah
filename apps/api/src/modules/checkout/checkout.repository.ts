import { CheckoutSessionModel } from './checkout.model.js';
import type { CheckoutSessionHydratedDoc } from './checkout.model.js';

/** The ONLY file allowed to touch `CheckoutSessionModel` (plan.md §5.4). */

export async function createSession(input: { cartId: string; userId: string | null; guestEmail: string | null; expiresAt: Date }): Promise<CheckoutSessionHydratedDoc> {
  return CheckoutSessionModel.create({ cartId: input.cartId, userId: input.userId, guestEmail: input.guestEmail, expiresAt: input.expiresAt, status: 'open' });
}

export async function findOpenSessionBySessionId(sessionId: string): Promise<CheckoutSessionHydratedDoc | null> {
  return CheckoutSessionModel.findOne({ sessionId, status: 'open' }).exec();
}

/** Status-agnostic lookup — unlike `findOpenSessionBySessionId`, matches a
 *  session in ANY status (`open`/`completed`/`expired`). Only `getSession`
 *  (the public, read-only `GET /checkout/session/:id`) uses this; every
 *  mutating operation (`setAddress`/`setShipping`/`createPaymentIntent`/
 *  `place`/`verifyCodOtp`) must keep requiring an `open` session via
 *  `findOpenSessionBySessionId` — this exists so a *read* of a session
 *  still works after `place()` has already marked it `completed`, which
 *  Ziina's hosted-redirect return page depends on (it has only the session
 *  id, from `success_url`/`cancel_url`/`failure_url`, to resolve the order
 *  that came from it — see `checkout.service.ts#buildCheckoutReturnUrls`). */
export async function findSessionBySessionId(sessionId: string): Promise<CheckoutSessionHydratedDoc | null> {
  return CheckoutSessionModel.findOne({ sessionId }).exec();
}

export async function save(doc: CheckoutSessionHydratedDoc): Promise<CheckoutSessionHydratedDoc> {
  return doc.save();
}

export async function markCompleted(sessionId: string, orderId: string, orderNumber: string): Promise<void> {
  await CheckoutSessionModel.updateOne({ sessionId }, { status: 'completed', orderId, orderNumber }).exec();
}
