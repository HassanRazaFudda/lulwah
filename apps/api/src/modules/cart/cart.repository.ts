import { CartModel } from './cart.model.js';
import type { CartHydratedDoc } from './cart.model.js';

/**
 * The ONLY file allowed to touch `CartModel` (plan.md §5.4). Unlike
 * `inventory.repository.ts`'s one-mutation-per-function style, `cart` has
 * many small, varied mutations (add/update/remove a line, apply/remove a
 * coupon, recalculate totals, merge two carts) — bespoke repository
 * functions for each would mostly be `{ field } = params; doc.field =
 * field; await doc.save()` boilerplate repeated eight times. Instead,
 * `cart.service.ts` loads a hydrated doc via `findCartByCartId`, mutates
 * its plain JS fields directly (arrays/subdocuments, not a Mongoose query
 * API), and calls `save()` here to persist — this file still owns every
 * byte of `CartModel`/Mongoose-specific code (query building, `.exec()`,
 * `.save()`), `cart.service.ts` only ever holds a document instance it was
 * handed. Documented deliberate deviation from the stricter one-function-
 * per-mutation convention `inventory` uses, justified by the mutation
 * count — see module report.
 */

export interface CreateCartInput {
  cartId: string;
  userId: string | null;
  sessionId: string;
  locale: 'en' | 'ar';
  expiresAt: Date;
}

export async function createCart(input: CreateCartInput): Promise<CartHydratedDoc> {
  return CartModel.create({
    cartId: input.cartId,
    userId: input.userId,
    sessionId: input.sessionId,
    locale: input.locale,
    currency: 'AED',
    status: 'active',
    lastActivityAt: new Date(),
    expiresAt: input.expiresAt,
  });
}

export async function findCartByCartId(cartId: string): Promise<CartHydratedDoc | null> {
  return CartModel.findOne({ cartId, status: 'active' }).exec();
}

export async function findActiveCartByUserId(userId: string): Promise<CartHydratedDoc | null> {
  return CartModel.findOne({ userId, status: 'active' }).sort({ lastActivityAt: -1 }).exec();
}

/** Persists whatever in-memory mutations `cart.service.ts` made to a
 *  hydrated doc it already holds — see this file's doc comment. */
export async function save(doc: CartHydratedDoc): Promise<CartHydratedDoc> {
  return doc.save();
}
