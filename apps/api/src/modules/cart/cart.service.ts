import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { AppError, notFoundError } from '../../shared/errors.js';
import { CART_COOKIE_TTL_MS, CART_MAX_LINES, CART_MAX_QTY_PER_LINE, CART_RESERVATION_TTL_MS, CHECKOUT_RESERVATION_TTL_MS } from '../../config/constants.js';
import * as repo from './cart.repository.js';
import type { CartHydratedDoc, CartItemDoc } from './cart.model.js';
import type { ReservationStore } from './reservation-store.js';
import { toCartResponse } from './cart.mapper.js';
import type { CartResponse } from './cart.dto.js';
import { cartEvents } from './cart.events.js';
// Read-only/write cross-module calls through each module's exported
// service interface, per plan.md §5.3 — never their repositories/models.
import * as variantService from '../catalog/variant.service.js';
import * as productService from '../catalog/product.service.js';
import * as inventoryService from '../inventory/inventory.service.js';
import * as identityService from '../identity/identity.service.js';
import * as pricingService from '../pricing/pricing.service.js';
import type { ApplyDiscountsResult, CartLineSnapshot } from '../pricing/discount-engine.js';
import * as settingsService from '../settings/settings.service.js';

/**
 * ALL cart business rules live here, framework-free (no `express`).
 * `cart.controller.ts` only parses/shapes; `cart.repository.ts` only
 * persists. The reservation flow (plan.md §8.4) always goes: acquire the
 * `ReservationStore`'s per-variant lock → call `inventory.service.ts`'s
 * `reserveStock`/`releaseStock` → update the store's own TTL/expiry
 * bookkeeping — never touching `InventoryItemModel` directly.
 */

async function requireCart(cartId: string): Promise<CartHydratedDoc> {
  const cart = await repo.findCartByCartId(cartId);
  if (!cart) throw new AppError('CART_NOT_FOUND', 404, { messageEn: 'Cart not found or has expired.' });
  return cart;
}

// ---------------------------------------------------------------------------
// Reservation helpers — plan.md §8.4, always run under the store's lock.
// ---------------------------------------------------------------------------

async function reserveAdditional(store: ReservationStore, cartId: string, variantId: string, quantity: number): Promise<void> {
  if (quantity <= 0) return;
  await store.withVariantLock(variantId, async () => {
    const result = await inventoryService.reserveStock({ variantId, quantity, reference: cartId });
    if (!result.ok) {
      throw new AppError('OUT_OF_STOCK', 409, {
        messageEn: result.available > 0 ? `Only ${result.available} piece${result.available === 1 ? '' : 's'} of this item ${result.available === 1 ? 'is' : 'are'} left.` : 'This item is out of stock.',
        details: { available: result.available },
      });
    }
    await store.markReserved(cartId, variantId, CART_RESERVATION_TTL_MS);
  });
}

/** Releases part of a line's reservation, keeping the line's marker alive
 *  (it still has a positive quantity) — the mirror of `reserveAdditional`. */
async function releasePartial(store: ReservationStore, cartId: string, variantId: string, quantity: number): Promise<void> {
  if (quantity <= 0) return;
  await store.withVariantLock(variantId, async () => {
    await inventoryService.releaseStock({ variantId, quantity, reference: cartId });
    await store.markReserved(cartId, variantId, CART_RESERVATION_TTL_MS);
  });
}

/** Releases a line's entire reservation and clears its marker — the line
 *  is going away (removed, or its reservation is being torn down ahead of
 *  a merge's fresh re-reservation). */
async function releaseAll(store: ReservationStore, cartId: string, variantId: string, quantity: number): Promise<void> {
  if (quantity <= 0) return;
  await store.withVariantLock(variantId, async () => {
    await inventoryService.releaseStock({ variantId, quantity, reference: cartId });
    await store.clearReserved(cartId, variantId);
  });
}

// ---------------------------------------------------------------------------
// Server-side recalculation — plan.md §8.5: "Cart totals: always
// recalculated server-side. The client renders what the server returns."
// Run on every read AND every mutation, never trusting a stored total.
// ---------------------------------------------------------------------------

function computeInclusiveTax(taxableFils: number, taxRate: number): number {
  if (taxableFils <= 0) return 0;
  return Math.round(taxableFils - taxableFils / (1 + taxRate));
}

export interface RecalculateResult {
  itemFlags: Map<string, { priceChanged: boolean; availableStock: number }>;
  discountResult: ApplyDiscountsResult;
}

/**
 * Mutates `cart`'s prices/totals/discount fields in place (the "silent
 * update" plan.md §8.5 asks for) and returns per-item flags for the
 * response DTO plus the raw discount-engine result (`applyCoupon` needs
 * the latter to surface a specific rejection reason). Does not save —
 * every caller below saves once after making its own mutations too, so a
 * single write covers both.
 *
 * Deliberately does NOT attempt to re-acquire a lapsed reservation on a
 * passive read — only mutation endpoints (`addItem`/`updateItemQuantity`)
 * take the per-variant lock, so `GET /cart/:cartId` stays a cheap,
 * lock-free Mongo read even though it still recomputes prices/discounts on
 * every call. `availableStock` on the response still tells the caller a
 * line is short; actually re-securing the stock is deferred to the next
 * mutation or to `checkout`'s own "validate stock, lock prices, extend
 * reservations" step (plan.md §9.5) — not built in this phase. Documented
 * trade-off, not an oversight.
 */
async function recalculate(cart: CartHydratedDoc): Promise<RecalculateResult> {
  const itemFlags = new Map<string, { priceChanged: boolean; availableStock: number }>();

  if (cart.items.length === 0) {
    cart.totals = { subtotalFils: 0, discountFils: 0, shippingFils: 0, codFeeFils: 0, taxFils: 0, grandTotalFils: 0 };
    cart.appliedCoupons = [];
    cart.automaticDiscounts = [];
    cart.lastActivityAt = new Date();
    return { itemFlags, discountResult: { lineDiscounts: new Map(), orderDiscountFils: 0, shippingDiscountFils: 0, applied: [], rejected: [] } };
  }

  const variantIds = [...new Set(cart.items.map((i) => i.variantId.toString()))];
  const productIds = [...new Set(cart.items.map((i) => i.productId.toString()))];

  const [variants, inventoryItems, products, settings] = await Promise.all([
    variantService.getVariantsByIds(variantIds),
    inventoryService.getInventoryForVariants(variantIds),
    productService.getProductsByIds(productIds),
    settingsService.getSettingsSnapshot(),
  ]);
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const inventoryByVariantId = new Map(inventoryItems.map((i) => [i.variantId, i]));
  const productById = new Map(products.map((p) => [p.id, p]));

  const lines: CartLineSnapshot[] = [];
  for (const item of cart.items) {
    const variantId = item.variantId.toString();
    const productId = item.productId.toString();
    const variant = variantById.get(variantId);
    const product = productById.get(productId);
    const availableStock = inventoryByVariantId.get(variantId)?.available ?? 0;

    let priceChanged = false;
    if (variant && variant.priceFils !== item.unitPriceFils) {
      item.unitPriceFils = variant.priceFils;
      item.compareAtPriceFils = variant.compareAtPriceFils;
      priceChanged = true;
    }
    itemFlags.set(item._id.toString(), { priceChanged, availableStock });

    lines.push({
      itemId: item._id.toString(),
      productId,
      variantId,
      categoryIds: product?.categoryIds ?? [],
      brandId: product?.brandId ?? '',
      collectionIds: product?.collectionIds ?? [],
      quantity: item.quantity,
      unitPriceFils: item.unitPriceFils,
      lineTotalFils: item.unitPriceFils * item.quantity,
    });
  }

  const subtotalFils = lines.reduce((sum, l) => sum + l.lineTotalFils, 0);

  let customerTags: string[] = [];
  if (cart.userId) {
    const user = await identityService.me(cart.userId.toString()).catch(() => null);
    customerTags = user?.tags ?? [];
  }

  const couponCode = cart.appliedCoupons[0]?.code ?? null;
  const discountResult = await pricingService.computeCartDiscounts({
    lines,
    subtotalFils,
    couponCode,
    // `isFirstOrder` can't be determined without order history — no
    // `order` module exists yet in this phase. `false` is the conservative
    // default: it can only ever under-grant a first-order-only discount,
    // never wrongly grant one to a repeat customer. Revisit once `order`
    // can report real purchase history.
    isFirstOrder: false,
    customerTags,
    paymentMethod: null,
    emirate: null,
    currentShippingFils: 0,
  });

  // Reconcile the applied coupon against what the engine actually accepted
  // (plan.md §8.5: "update it silently" applies here too — a coupon that's
  // become ineligible since it was applied just quietly falls off; the
  // *mutation* endpoint, `applyCoupon`, is what surfaces a rejection reason
  // to the shopper at the moment they type a code in).
  if (couponCode) {
    const stillApplied = discountResult.applied.find((a) => a.code?.toUpperCase() === couponCode.toUpperCase());
    cart.appliedCoupons = stillApplied
      ? [{ code: couponCode, discountId: new Types.ObjectId(stillApplied.discountId), amountFils: stillApplied.amountFils + stillApplied.shippingAmountFils }]
      : [];
  }
  cart.automaticDiscounts = discountResult.applied
    .filter((a) => a.code === null)
    .map((a) => ({ discountId: new Types.ObjectId(a.discountId), name: a.name, amountFils: a.amountFils + a.shippingAmountFils }));

  const shippingFils = 0; // resolved at checkout — plan.md §9.5, not this phase
  const codFeeFils = 0; // resolved once a payment method is chosen at checkout
  const discountFils = Math.min(discountResult.orderDiscountFils, subtotalFils);
  const taxableFils = Math.max(0, subtotalFils - discountFils + shippingFils);
  const taxFils = computeInclusiveTax(taxableFils, settings.taxRate);
  const grandTotalFils = Math.max(0, subtotalFils - discountFils + shippingFils + codFeeFils);

  cart.totals = { subtotalFils, discountFils, shippingFils, codFeeFils, taxFils, grandTotalFils };
  cart.lastActivityAt = new Date();

  return { itemFlags, discountResult };
}

// ---------------------------------------------------------------------------
// Public service surface — plan.md §9.5
// ---------------------------------------------------------------------------

export async function createOrGetCart(params: { existingCartId: string | null; locale: 'en' | 'ar' }): Promise<{ cart: CartResponse; cartId: string }> {
  if (params.existingCartId) {
    const existing = await repo.findCartByCartId(params.existingCartId);
    if (existing) {
      const { itemFlags } = await recalculate(existing);
      await repo.save(existing);
      return { cart: toCartResponse(existing, itemFlags), cartId: existing.cartId };
    }
  }
  const cartId = randomUUID();
  const created = await repo.createCart({ cartId, userId: null, sessionId: randomUUID(), locale: params.locale, expiresAt: new Date(Date.now() + CART_COOKIE_TTL_MS) });
  return { cart: toCartResponse(created, new Map()), cartId: created.cartId };
}

export async function getCart(cartId: string): Promise<CartResponse> {
  const cart = await requireCart(cartId);
  const { itemFlags } = await recalculate(cart);
  await repo.save(cart);
  return toCartResponse(cart, itemFlags);
}

export async function addItem(store: ReservationStore, cartId: string, input: { variantId: string; quantity: number }): Promise<CartResponse> {
  const cart = await requireCart(cartId);

  const variant = await variantService.getVariantById(input.variantId);
  if (!variant || !variant.isActive) throw new AppError('VARIANT_INACTIVE', 409, { messageEn: 'This item is no longer available.' });

  const existingItem = cart.items.find((i) => i.variantId.toString() === input.variantId);
  const currentQty = existingItem?.quantity ?? 0;
  const nextQty = currentQty + input.quantity;
  if (nextQty > CART_MAX_QTY_PER_LINE) {
    throw new AppError('CART_QTY_LIMIT', 409, { messageEn: `You can add up to ${CART_MAX_QTY_PER_LINE} of this item per order.`, details: { max: CART_MAX_QTY_PER_LINE } });
  }
  if (!existingItem && cart.items.length >= CART_MAX_LINES) {
    throw new AppError('CART_ITEM_LIMIT', 409, { messageEn: `A cart can hold up to ${CART_MAX_LINES} different items.`, details: { max: CART_MAX_LINES } });
  }

  await reserveAdditional(store, cartId, input.variantId, input.quantity);

  if (existingItem) {
    existingItem.quantity = nextQty;
  } else {
    cart.items.push({
      productId: new Types.ObjectId(variant.productId),
      variantId: new Types.ObjectId(variant.id),
      quantity: input.quantity,
      unitPriceFils: variant.priceFils,
      compareAtPriceFils: variant.compareAtPriceFils,
      stitching: null,
      giftWrap: false,
      addedAt: new Date(),
      priceLockedUntil: new Date(Date.now() + CART_RESERVATION_TTL_MS),
    } as CartItemDoc);
  }

  const { itemFlags } = await recalculate(cart);
  await repo.save(cart);
  cartEvents.publish('cart.item_added', { cartId, variantId: input.variantId, quantity: input.quantity });
  return toCartResponse(cart, itemFlags);
}

export async function updateItemQuantity(store: ReservationStore, cartId: string, itemId: string, quantity: number): Promise<CartResponse> {
  const cart = await requireCart(cartId);
  const item = cart.items.id(itemId);
  if (!item) throw notFoundError('Cart item not found.');

  const variantId = item.variantId.toString();
  const delta = quantity - item.quantity;
  if (delta > 0) await reserveAdditional(store, cartId, variantId, delta);
  else if (delta < 0) await releasePartial(store, cartId, variantId, -delta);

  item.quantity = quantity;

  const { itemFlags } = await recalculate(cart);
  await repo.save(cart);
  return toCartResponse(cart, itemFlags);
}

export async function removeItem(store: ReservationStore, cartId: string, itemId: string): Promise<CartResponse> {
  const cart = await requireCart(cartId);
  const item = cart.items.id(itemId);
  if (!item) throw notFoundError('Cart item not found.');

  await releaseAll(store, cartId, item.variantId.toString(), item.quantity);
  cart.items.pull(itemId);

  const { itemFlags } = await recalculate(cart);
  await repo.save(cart);
  return toCartResponse(cart, itemFlags);
}

export async function applyCoupon(cartId: string, code: string): Promise<CartResponse> {
  const cart = await requireCart(cartId);
  const upperCode = code.trim().toUpperCase();
  if (!upperCode) throw new AppError('COUPON_INVALID', 400, { messageEn: 'Enter a code.', field: 'code' });

  // Stage the candidate code — plan.md §8.3: "a second code replaces the
  // first." `recalculate()` resolves the real `discountId`/`amountFils` (or
  // clears this entirely if the engine doesn't accept it).
  cart.appliedCoupons = [{ code: upperCode, discountId: new Types.ObjectId(), amountFils: 0 }];

  const { itemFlags, discountResult } = await recalculate(cart);

  const rejection = discountResult.rejected.find((r) => r.code?.toUpperCase() === upperCode);
  if (rejection) {
    throw new AppError(rejection.errorCode, 400, { messageEn: rejection.reason, field: 'code' });
  }
  if (cart.appliedCoupons.length === 0) {
    throw new AppError('COUPON_INVALID', 400, { messageEn: 'This code does not exist.', field: 'code' });
  }

  await repo.save(cart);
  return toCartResponse(cart, itemFlags);
}

export async function removeCoupon(cartId: string): Promise<CartResponse> {
  const cart = await requireCart(cartId);
  cart.appliedCoupons = [];
  const { itemFlags } = await recalculate(cart);
  await repo.save(cart);
  return toCartResponse(cart, itemFlags);
}

// ---------------------------------------------------------------------------
// Checkout hand-off — plan.md §9.5. `checkout`'s exclusive entry point into
// `cart` for these two operations (plan.md §5.3: exported service function,
// never `CartModel`/`ReservationStore` internals directly). A narrow,
// deliberate extension of this module — the same category as `inventory
// .service.ts`'s `reserveStock`/`releaseStock` being added here for cart's
// own use one phase ago; `checkout` needs exactly this much of cart's
// internals and no more.
// ---------------------------------------------------------------------------

/**
 * `POST /checkout/session` — plan.md §9.5: "validates the cart's stock is
 * still available, locks prices, extends the cart's reservation from
 * `CART_RESERVATION_TTL_MS` to `CHECKOUT_RESERVATION_TTL_MS`." Re-runs the
 * same `recalculate()` every mutation already goes through (so a price
 * change or a stock shortfall is caught here too, not just on the next
 * cart read), then re-marks every line's reservation under the longer
 * checkout TTL. Throws `OUT_OF_STOCK` for any line whose reservation can't
 * cover its current quantity — checkout has no business starting from a
 * cart it can't actually fulfil.
 */
export async function extendReservationForCheckout(store: ReservationStore, cartId: string): Promise<CartResponse> {
  const cart = await requireCart(cartId);
  if (cart.items.length === 0) {
    throw new AppError('VALIDATION_FAILED', 400, { messageEn: 'Your cart is empty.' });
  }

  const { itemFlags } = await recalculate(cart);
  for (const item of cart.items) {
    const flags = itemFlags.get(item._id.toString());
    if (flags && flags.availableStock < item.quantity) {
      throw new AppError('OUT_OF_STOCK', 409, {
        messageEn: flags.availableStock > 0 ? `Only ${flags.availableStock} piece${flags.availableStock === 1 ? '' : 's'} of one item in your cart ${flags.availableStock === 1 ? 'is' : 'are'} left.` : 'One of the items in your cart is out of stock.',
        details: { variantId: item.variantId.toString(), available: flags.availableStock },
      });
    }
  }

  for (const item of cart.items) {
    const variantId = item.variantId.toString();
    await store.withVariantLock(variantId, async () => {
      await store.markReserved(cartId, variantId, CHECKOUT_RESERVATION_TTL_MS);
    });
  }

  await repo.save(cart);
  return toCartResponse(cart, itemFlags);
}

/** `POST /checkout/session/:id/place` — marks the cart `converted` once an
 *  order has actually been created from it (plan.md §7.10's `CartStatus`
 *  already includes this value; nothing set it before `checkout` existed).
 *  A converted cart no longer resolves via `findCartByCartId`
 *  (`status: 'active'`-scoped), so it naturally drops out of every
 *  cart-mutation code path from this point on. */
export async function convertCart(cartId: string): Promise<void> {
  await repo.markConverted(cartId);
}

// ---------------------------------------------------------------------------
// Merge on login — plan.md §8.5/§9.5
// ---------------------------------------------------------------------------

interface MergedLine {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
  unitPriceFils: number;
  compareAtPriceFils: number | null;
  giftWrap: boolean;
  addedAt: Date;
}

export async function mergeCartOnLogin(store: ReservationStore, guestCartId: string | null, userId: string): Promise<{ cart: CartResponse; cartId: string }> {
  const guestCart = guestCartId ? await repo.findCartByCartId(guestCartId) : null;
  const userCart = await repo.findActiveCartByUserId(userId);

  if (!guestCart && !userCart) {
    const cartId = randomUUID();
    const created = await repo.createCart({ cartId, userId, sessionId: randomUUID(), locale: 'en', expiresAt: new Date(Date.now() + CART_COOKIE_TTL_MS) });
    return { cart: toCartResponse(created, new Map()), cartId: created.cartId };
  }

  if (guestCart && !userCart) {
    guestCart.userId = new Types.ObjectId(userId);
    const { itemFlags } = await recalculate(guestCart);
    await repo.save(guestCart);
    cartEvents.publish('cart.merged', { cartId: guestCart.cartId, userId });
    return { cart: toCartResponse(guestCart, itemFlags), cartId: guestCart.cartId };
  }

  if (!guestCart && userCart) {
    const { itemFlags } = await recalculate(userCart);
    await repo.save(userCart);
    return { cart: toCartResponse(userCart, itemFlags), cartId: userCart.cartId };
  }

  // Both exist — real union merge (TypeScript can't narrow `guestCart`/
  // `userCart` to non-null across the three early returns above, so this
  // is delegated to a helper that takes them as already-non-null params
  // rather than reaching for a non-null assertion here).
  return mergeBothCarts(store, guestCart as CartHydratedDoc, userCart as CartHydratedDoc, userId);
}

/** plan.md §8.5: "Union of items; same variant → max(qty), not sum. Prices
 *  re-resolved to current." Split out of `mergeCartOnLogin` purely so
 *  `guest`/`user` are ordinary non-null parameters instead of asserted
 *  from already-checked-but-not-narrowed outer variables. */
async function mergeBothCarts(store: ReservationStore, guest: CartHydratedDoc, user: CartHydratedDoc, userId: string): Promise<{ cart: CartResponse; cartId: string }> {
  // Release every existing reservation on both sides first, then re-reserve
  // fresh for the final merged quantities — simpler and more obviously
  // correct than delta-tracking across two carts being combined into one,
  // at the cost of a brief window where the stock isn't held by anyone.
  // Acceptable for a login-time operation (rare, not a hot path).
  for (const item of guest.items) await releaseAll(store, guest.cartId, item.variantId.toString(), item.quantity);
  for (const item of user.items) await releaseAll(store, user.cartId, item.variantId.toString(), item.quantity);

  const merged = new Map<string, MergedLine>();
  for (const item of user.items) {
    merged.set(item.variantId.toString(), { productId: item.productId, variantId: item.variantId, quantity: item.quantity, unitPriceFils: item.unitPriceFils, compareAtPriceFils: item.compareAtPriceFils, giftWrap: item.giftWrap, addedAt: item.addedAt });
  }
  for (const item of guest.items) {
    const key = item.variantId.toString();
    const existing = merged.get(key);
    if (existing) existing.quantity = Math.max(existing.quantity, item.quantity);
    else merged.set(key, { productId: item.productId, variantId: item.variantId, quantity: item.quantity, unitPriceFils: item.unitPriceFils, compareAtPriceFils: item.compareAtPriceFils, giftWrap: item.giftWrap, addedAt: item.addedAt });
  }

  let mergedLines = [...merged.values()].map((l) => ({ ...l, quantity: Math.min(l.quantity, CART_MAX_QTY_PER_LINE) }));
  if (mergedLines.length > CART_MAX_LINES) {
    mergedLines = mergedLines.sort((a, b) => b.quantity - a.quantity).slice(0, CART_MAX_LINES);
  }

  // Re-reserve fresh for each merged line. A variant that no longer has
  // enough stock is clamped to whatever IS available rather than failing
  // sign-in outright; a line that's now fully out of stock is dropped
  // (`Cart.items[].quantity` is a positive integer by contract — there is
  // no "zero-quantity, kept for a saved-for-later UI" state to put it in
  // at this layer; that's a storefront-side concept, not built here).
  const reservedLines: MergedLine[] = [];
  for (const line of mergedLines) {
    const variantId = line.variantId.toString();
    let quantity = line.quantity;
    try {
      await reserveAdditional(store, user.cartId, variantId, quantity);
    } catch (err) {
      if (!(err instanceof AppError && err.code === 'OUT_OF_STOCK')) throw err;
      const available = typeof err.details?.['available'] === 'number' ? (err.details['available'] as number) : 0;
      if (available <= 0) continue;
      await reserveAdditional(store, user.cartId, variantId, available);
      quantity = available;
    }
    reservedLines.push({ ...line, quantity });
  }

  user.items = reservedLines.map((l) => ({
    productId: l.productId,
    variantId: l.variantId,
    quantity: l.quantity,
    unitPriceFils: l.unitPriceFils,
    compareAtPriceFils: l.compareAtPriceFils,
    stitching: null,
    giftWrap: l.giftWrap,
    addedAt: l.addedAt,
    priceLockedUntil: new Date(Date.now() + CART_RESERVATION_TTL_MS),
  })) as unknown as CartHydratedDoc['items'];

  guest.status = 'merged';
  await repo.save(guest);

  const { itemFlags } = await recalculate(user);
  await repo.save(user);
  cartEvents.publish('cart.merged', { cartId: user.cartId, userId });

  return { cart: toCartResponse(user, itemFlags), cartId: user.cartId };
}

// ---------------------------------------------------------------------------
// Reservation sweep — plan.md §8.4, called by `jobs/reservation-sweep.job.ts`
// on a 60s BullMQ repeatable job.
// ---------------------------------------------------------------------------

/** Reclaims stock for reservations whose Redis TTL genuinely lapsed
 *  (`store.popExpired`). Reads the live cart to find the line's *current*
 *  quantity (it may have changed since the reservation was written, or the
 *  line may be gone entirely) rather than remembering a stale amount —
 *  see `reservation-store.ts`'s doc comment for why this also naturally
 *  guards against the store's one documented race window. Returns how many
 *  it actually released, for the job's own logging/tests. */
export async function sweepExpiredReservations(store: ReservationStore, limit = 200): Promise<number> {
  const expired = await store.popExpired(limit);
  let released = 0;
  for (const { cartId, variantId } of expired) {
    const cart = await repo.findCartByCartId(cartId);
    const item = cart?.items.find((i) => i.variantId.toString() === variantId);
    if (!item) continue; // already released by an explicit mutation, or the cart is gone
    await inventoryService.releaseStock({ variantId, quantity: item.quantity, reference: `${cartId} (sweep)` });
    released += 1;
  }
  return released;
}
