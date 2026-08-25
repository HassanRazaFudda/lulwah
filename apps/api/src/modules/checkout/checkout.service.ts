import { Types } from 'mongoose';
import type { Order, PaymentMethod } from '@lulwah/contracts';
import { env } from '../../shared/env.js';
import { AppError } from '../../shared/errors.js';
import { CHECKOUT_RESERVATION_TTL_MS } from '../../config/constants.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as identityService from '../identity/identity.service.js';
import * as addressService from '../identity/address.service.js';
import * as cartService from '../cart/cart.service.js';
import type { ReservationStore } from '../cart/reservation-store.js';
import * as productService from '../catalog/product.service.js';
import * as variantService from '../catalog/variant.service.js';
import * as brandService from '../catalog/brand.service.js';
import * as inventoryService from '../inventory/inventory.service.js';
import * as pricingService from '../pricing/pricing.service.js';
import type { ApplyDiscountsResult, CartLineSnapshot } from '../pricing/discount-engine.js';
import * as orderService from '../order/order.service.js';
import type { CreateOrderFromCheckoutItemInput } from '../order/order.service.js';
import * as paymentService from '../payment/payment.service.js';
import * as repo from './checkout.repository.js';
import type { CheckoutSessionDoc, CheckoutSessionHydratedDoc } from './checkout.model.js';
import { toCheckoutSessionResponse } from './checkout.mapper.js';
import type { CheckoutSessionResponse, InlineAddressInput, PaymentIntentResponse, SetCheckoutAddressInput } from './checkout.dto.js';
import { quoteShipping } from './shipping-rates.js';
import type { IdempotencyStore } from './idempotency-store.js';

/**
 * ALL checkout business rules live here, framework-free (no `express` —
 * plan.md §5.4). `checkout.controller.ts` only parses/shapes; `checkout
 * .repository.ts` only persists.
 */

function computeInclusiveTax(taxableFils: number): number {
  if (taxableFils <= 0) return 0;
  // Duplicated from `cart.service.ts`'s private (unexported) helper of the
  // same name/body rather than imported — three lines, and importing a
  // service module's internal helper across a module boundary would be a
  // worse coupling than the duplication itself (plan.md §5.3: only
  // *exported* functions cross a module boundary).
  return Math.round(taxableFils - taxableFils / (1 + env.VAT_RATE));
}

async function requireOpenSession(sessionId: string): Promise<CheckoutSessionHydratedDoc> {
  const session = await repo.findOpenSessionBySessionId(sessionId);
  if (!session || session.expiresAt.getTime() < Date.now()) {
    throw new AppError('CHECKOUT_SESSION_EXPIRED', 409, { messageEn: 'This checkout session has expired. Please start checkout again.' });
  }
  return session;
}

/** Logged-in ownership check, guest sessions have no owner to check
 *  (plan.md §15.6) — the session id itself is the only credential, same as
 *  `cart`'s `cartId` cookie. Not found (rather than forbidden) on a
 *  mismatch, so an authenticated attacker guessing session ids can't
 *  distinguish "wrong owner" from "doesn't exist". */
function assertSessionOwnership(session: CheckoutSessionHydratedDoc, actor: AuthenticatedUser | null): void {
  if (session.userId && actor && session.userId.toString() !== actor.id) {
    throw new AppError('CHECKOUT_SESSION_EXPIRED', 404, { messageEn: 'Checkout session not found.' });
  }
}

// ---------------------------------------------------------------------------
// Pricing — re-derived from the discount engine at every mutating step, not
// copied from the cart's own aggregate totals (plan.md §8.3: recalculation
// happens "again at order creation" — this module treats every one of its
// own steps the same way, since each one can change what's eligible:
// address reveals `emirate`, shipping reveals its own fee, a payment method
// choice reveals `paymentMethod`/adds the COD fee). Mutates `session`'s
// money fields in place and returns the full `ApplyDiscountsResult` so
// `place` can pull the line-level allocation it needs to build `Order
// .items[].lineDiscountFils` — see this file's own doc comment on why cart's
// `CartResponse` DTO can't supply that (it never carries per-line discount
// data on the wire).
// ---------------------------------------------------------------------------

async function computeSessionPricing(session: CheckoutSessionHydratedDoc, actor: AuthenticatedUser | null): Promise<ApplyDiscountsResult> {
  const productIds = [...new Set(session.items.map((i) => i.productId.toString()))];
  const products = await productService.getProductsByIds(productIds);
  const productById = new Map(products.map((p) => [p.id, p]));

  const lines: CartLineSnapshot[] = session.items.map((item) => {
    const product = productById.get(item.productId.toString());
    return {
      itemId: item.variantId.toString(), // stable, unique per session by construction (one line per variant)
      productId: item.productId.toString(),
      variantId: item.variantId.toString(),
      categoryIds: product?.categoryIds ?? [],
      brandId: product?.brandId ?? '',
      collectionIds: product?.collectionIds ?? [],
      quantity: item.quantity,
      unitPriceFils: item.unitPriceFils,
      lineTotalFils: item.unitPriceFils * item.quantity,
    };
  });
  const subtotalFils = lines.reduce((sum, l) => sum + l.lineTotalFils, 0);

  let customerTags: string[] = [];
  let isFirstOrder = false;
  if (actor) {
    const [user, hasPrior] = await Promise.all([identityService.me(actor.id).catch(() => null), orderService.hasPriorOrders(actor.id)]);
    customerTags = user?.tags ?? [];
    isFirstOrder = !hasPrior;
  }

  const discountResult = await pricingService.computeCartDiscounts({
    lines,
    subtotalFils,
    couponCode: session.couponCode,
    isFirstOrder,
    customerTags,
    paymentMethod: session.paymentMethod,
    emirate: session.shippingAddress?.emirate ?? null,
    currentShippingFils: session.shippingMethod?.priceFils ?? 0,
  });

  const discountFils = Math.min(discountResult.orderDiscountFils, subtotalFils);
  const shippingBeforeDiscountFils = session.shippingMethod?.priceFils ?? 0;
  const shippingFils = Math.max(0, shippingBeforeDiscountFils - discountResult.shippingDiscountFils);
  const codFeeFils = session.paymentMethod === 'cod' ? env.COD_FEE_FILS : 0;
  const taxableFils = Math.max(0, subtotalFils - discountFils + shippingFils);
  const taxFils = computeInclusiveTax(taxableFils);
  const grandTotalFils = Math.max(0, subtotalFils - discountFils + shippingFils + codFeeFils);

  session.subtotalFils = subtotalFils;
  session.discountFils = discountFils;
  session.shippingFils = shippingFils;
  session.codFeeFils = codFeeFils;
  session.taxFils = taxFils;
  session.grandTotalFils = grandTotalFils;
  session.discounts = discountResult.applied.map((a) => ({
    discountId: new Types.ObjectId(a.discountId),
    code: a.code,
    type: a.type,
    amountFils: a.type === 'free_shipping' ? a.shippingAmountFils : a.amountFils,
    appliedTo: a.type === 'free_shipping' ? 'shipping' : 'order',
    itemId: null,
  }));

  return discountResult;
}

// ---------------------------------------------------------------------------
// Session creation — plan.md §9.5
// ---------------------------------------------------------------------------

export async function createSession(store: ReservationStore, actor: AuthenticatedUser | null, input: { cartId: string; guestEmail?: string | undefined }): Promise<CheckoutSessionResponse> {
  const cart = await cartService.extendReservationForCheckout(store, input.cartId);

  const productIds = [...new Set(cart.items.map((i) => i.productId))];
  const variantIds = [...new Set(cart.items.map((i) => i.variantId))];
  const [products, variants] = await Promise.all([productService.getProductsByIds(productIds), variantService.getVariantsByIds(variantIds)]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const brandIds = [...new Set(products.map((p) => p.brandId))];
  const brands = await brandService.getBrandsByIds(brandIds);
  const brandById = new Map(brands.map((b) => [b.id, b]));

  const expiresAt = new Date(Date.now() + CHECKOUT_RESERVATION_TTL_MS);
  const session = await repo.createSession({ cartId: cart.cartId, userId: actor?.id ?? null, guestEmail: actor ? null : (input.guestEmail ?? null), expiresAt });

  session.couponCode = cart.appliedCoupons[0]?.code ?? null;
  session.items = cart.items.map((item) => {
    const product = productById.get(item.productId);
    const variant = variantById.get(item.variantId);
    const primaryImage = product?.media.find((m) => m.isPrimary) ?? product?.media[0];
    return {
      productId: new Types.ObjectId(item.productId),
      variantId: new Types.ObjectId(item.variantId),
      quantity: item.quantity,
      unitPriceFils: item.unitPriceFils,
      compareAtPriceFils: item.compareAtPriceFils,
      titleSnapshot: product?.title ?? 'Product',
      brandSnapshot: brandById.get(product?.brandId ?? '')?.name ?? '',
      imageSnapshot: primaryImage?.url ?? '',
      skuSnapshot: variant?.sku ?? '',
      articleCodeSnapshot: product?.articleCode ?? '',
      stitchingTypeSnapshot: product?.stitchingType ?? '',
      optionsSnapshot: { size: variant?.options.size ?? null, color: variant?.options.color ?? null, pieceCount: variant?.options.pieceCount ?? null },
    };
  }) as CheckoutSessionDoc['items'];

  await computeSessionPricing(session, actor);
  await repo.save(session);
  return toCheckoutSessionResponse(session);
}

export async function getSession(sessionId: string, actor: AuthenticatedUser | null): Promise<CheckoutSessionResponse> {
  const session = await requireOpenSession(sessionId);
  assertSessionOwnership(session, actor);
  return toCheckoutSessionResponse(session);
}

// ---------------------------------------------------------------------------
// Address — plan.md §9.5
// ---------------------------------------------------------------------------

async function resolveAddress(actor: AuthenticatedUser | null, choice: { addressId?: string | undefined; inline?: InlineAddressInput | undefined }): Promise<CheckoutSessionDoc['shippingAddress']> {
  if (choice.addressId) {
    if (!actor) throw new AppError('CHECKOUT_ADDRESS_INVALID', 400, { messageEn: 'Sign in to use a saved address, or enter one for this order.' });
    const snapshot = await addressService.getAddressSnapshot(actor.id, choice.addressId);
    return { label: snapshot.label, firstName: snapshot.firstName, lastName: snapshot.lastName, phone: snapshot.phone, emirate: snapshot.emirate, city: snapshot.city, area: snapshot.area, buildingName: snapshot.buildingName, apartment: snapshot.apartment ?? null, street: snapshot.street ?? null, landmark: snapshot.landmark, makani: snapshot.makani, poBox: snapshot.poBox, country: snapshot.country, geo: snapshot.geo };
  }
  if (choice.inline) {
    const a = choice.inline;
    return { label: a.label, firstName: a.firstName, lastName: a.lastName, phone: a.phone, emirate: a.emirate, city: a.city, area: a.area, buildingName: a.buildingName, apartment: a.apartment ?? null, street: a.street ?? null, landmark: a.landmark, makani: a.makani, poBox: a.poBox, country: 'AE', geo: a.geo };
  }
  throw new AppError('CHECKOUT_ADDRESS_INVALID', 400, { messageEn: 'Provide an address.' });
}

export async function setAddress(actor: AuthenticatedUser | null, sessionId: string, input: SetCheckoutAddressInput): Promise<CheckoutSessionResponse> {
  const session = await requireOpenSession(sessionId);
  assertSessionOwnership(session, actor);

  const shippingAddress = await resolveAddress(actor, input.shipping);
  const billingAddress = input.billingSameAsShipping ? shippingAddress : await resolveAddress(actor, input.billing ?? {});

  session.shippingAddress = shippingAddress;
  session.billingAddress = billingAddress;
  // A previously-chosen shipping method's rate was quoted for the OLD
  // emirate — clear it so `setShipping` must be called again for the new
  // address before `place` can succeed, rather than silently carrying a
  // stale flat-rate quote forward.
  session.shippingMethod = null;

  await computeSessionPricing(session, actor);
  await repo.save(session);
  return toCheckoutSessionResponse(session);
}

// ---------------------------------------------------------------------------
// Shipping — plan.md §9.5, §21
// ---------------------------------------------------------------------------

export async function setShipping(actor: AuthenticatedUser | null, sessionId: string): Promise<CheckoutSessionResponse> {
  const session = await requireOpenSession(sessionId);
  assertSessionOwnership(session, actor);
  if (!session.shippingAddress) throw new AppError('CHECKOUT_ADDRESS_INVALID', 400, { messageEn: 'Add a shipping address first.' });

  const quote = quoteShipping(session.shippingAddress.emirate, session.subtotalFils);
  session.shippingMethod = { id: quote.id, name: quote.name, carrier: quote.carrier, etaMinDays: quote.etaMinDays, etaMaxDays: quote.etaMaxDays, priceFils: quote.priceFils };

  await computeSessionPricing(session, actor);
  await repo.save(session);
  return toCheckoutSessionResponse(session);
}

// ---------------------------------------------------------------------------
// Payment intent — plan.md §9.5, §20
// ---------------------------------------------------------------------------

export async function createPaymentIntent(actor: AuthenticatedUser | null, sessionId: string, method: PaymentMethod): Promise<PaymentIntentResponse> {
  const session = await requireOpenSession(sessionId);
  assertSessionOwnership(session, actor);
  if (!session.shippingMethod) throw new AppError('CHECKOUT_ADDRESS_INVALID', 400, { messageEn: 'Choose a shipping method first.' });
  if (method !== 'cod' && method !== 'card') {
    throw new AppError('SERVICE_UNAVAILABLE', 503, { messageEn: 'This payment method is not available yet.' });
  }

  session.paymentMethod = method;
  session.codVerifiedAt = null;
  await computeSessionPricing(session, actor);

  if (method === 'cod' && session.grandTotalFils > env.COD_MAX_ORDER_FILS) {
    throw new AppError('COD_LIMIT_EXCEEDED', 409, { messageEn: 'This order total is too high for cash on delivery. Please pay by card instead.', details: { maxFils: env.COD_MAX_ORDER_FILS } });
  }

  const email = actor ? (await identityService.me(actor.id).catch(() => null))?.email ?? null : (session.guestEmail ?? null);
  const phone = session.shippingAddress ? `${session.shippingAddress.phone.countryCode}${session.shippingAddress.phone.number}` : null;

  if (method === 'cod') {
    if (!phone) throw new AppError('CHECKOUT_ADDRESS_INVALID', 400, { messageEn: 'A shipping address with a phone number is required for cash on delivery.' });
    const { intentId } = await paymentService.requestCodOtp(session.sessionId, phone);
    session.paymentGateway = 'cod';
    session.paymentIntentId = intentId;
    await repo.save(session);
    return { method: 'cod', clientSecret: null, otpRequired: true };
  }

  const intent = await paymentService.createCardIntent({ reference: session.sessionId, amountFils: session.grandTotalFils, currency: 'AED', customerEmail: email, customerPhone: phone });
  session.paymentGateway = 'stripe';
  session.paymentIntentId = intent.intentId;
  await repo.save(session);
  return { method: 'card', clientSecret: intent.clientSecret, otpRequired: false };
}

// ---------------------------------------------------------------------------
// COD OTP — plan.md §9.5
// ---------------------------------------------------------------------------

export async function verifyCodOtp(sessionId: string, code: string): Promise<CheckoutSessionResponse> {
  const session = await requireOpenSession(sessionId);
  if (session.paymentMethod !== 'cod') throw new AppError('VALIDATION_FAILED', 400, { messageEn: 'This checkout session is not using cash on delivery.' });

  const result = await paymentService.verifyCodOtp(sessionId, code);
  if (!result.verified) {
    if (result.reason === 'expired') throw new AppError('AUTH_OTP_EXPIRED', 400, { messageEn: 'This code has expired. Request a new one.' });
    if (result.reason === 'too_many_attempts') throw new AppError('AUTH_OTP_INVALID', 429, { messageEn: 'Too many incorrect attempts. Request a new code.' });
    throw new AppError('AUTH_OTP_INVALID', 400, { messageEn: 'Incorrect code. Please try again.', field: 'code' });
  }

  session.codVerifiedAt = new Date();
  await repo.save(session);
  return toCheckoutSessionResponse(session);
}

// ---------------------------------------------------------------------------
// Place — plan.md §9.5: "requires an Idempotency-Key header." The one
// endpoint where getting this right actually matters — a retried request
// must not create a second order.
// ---------------------------------------------------------------------------

export async function place(
  store: ReservationStore,
  idempotencyStore: IdempotencyStore,
  actor: AuthenticatedUser | null,
  sessionId: string,
  idempotencyKey: string,
  customerNote: string | undefined,
): Promise<{ order: Order; replayed: boolean }> {
  const claim = await idempotencyStore.claim(idempotencyKey);
  if (claim.state === 'in_progress') {
    throw new AppError('IDEMPOTENCY_CONFLICT', 409, { messageEn: 'This request is already being processed.' });
  }
  if (claim.state === 'done') {
    const existing = await orderService.getOrderByIdempotencyKey(idempotencyKey);
    if (existing) return { order: existing, replayed: true };
    // The Redis record survived but the order it pointed to didn't (should
    // not happen in practice) — fall through and let Mongo's own unique
    // index be the final word, same as the fresh-attempt path below.
  }

  try {
    const session = await requireOpenSession(sessionId);
    assertSessionOwnership(session, actor);

    if (!session.shippingAddress || !session.billingAddress) throw new AppError('CHECKOUT_ADDRESS_INVALID', 400, { messageEn: 'Add a shipping address first.' });
    if (!session.shippingMethod) throw new AppError('CHECKOUT_ADDRESS_INVALID', 400, { messageEn: 'Choose a shipping method first.' });
    if (!session.paymentMethod) throw new AppError('PAYMENT_FAILED', 400, { messageEn: 'Choose a payment method first.' });
    if (session.paymentMethod === 'cod' && !session.codVerifiedAt) {
      throw new AppError('COD_OTP_REQUIRED', 400, { messageEn: 'Verify the OTP sent to your phone before placing a cash-on-delivery order.' });
    }
    if (!actor && !session.guestEmail) {
      throw new AppError('VALIDATION_FAILED', 400, { messageEn: 'An email address is required to track this order.', field: 'guestEmail' });
    }

    // Re-validate stock/price one more time (plan.md §9.5) — the session
    // locked prices at `POST /checkout/session`; this catches drift during
    // the checkout window (a repriced product, a reservation that lapsed
    // via the sweep job racing a slow customer).
    const variantIds = session.items.map((i) => i.variantId.toString());
    const [liveVariants, liveInventory] = await Promise.all([variantService.getVariantsByIds(variantIds), inventoryService.getInventoryForVariants(variantIds)]);
    const liveVariantById = new Map(liveVariants.map((v) => [v.id, v]));
    const liveInventoryByVariantId = new Map(liveInventory.map((i) => [i.variantId, i]));
    for (const item of session.items) {
      const variantId = item.variantId.toString();
      const liveVariant = liveVariantById.get(variantId);
      if (!liveVariant || liveVariant.priceFils !== item.unitPriceFils) {
        throw new AppError('CHECKOUT_PRICE_CHANGED', 409, { messageEn: 'A price changed since you started checkout. Please review your order again.', details: { variantId } });
      }
      const available = liveInventoryByVariantId.get(variantId)?.available ?? 0;
      if (available < item.quantity) {
        throw new AppError('OUT_OF_STOCK', 409, { messageEn: 'An item in your order is no longer available in that quantity.', details: { variantId, available } });
      }
    }

    // Apply discounts one final time (plan.md §8.3/§9.5) — the freshest
    // possible read, right before the snapshot that becomes permanent.
    const discountResult = await computeSessionPricing(session, actor);
    await repo.save(session);

    const items: CreateOrderFromCheckoutItemInput[] = session.items.map((item) => {
      const variantId = item.variantId.toString();
      const lineDiscountFils = discountResult.lineDiscounts.get(variantId) ?? 0;
      const lineTotalBeforeTax = item.unitPriceFils * item.quantity - lineDiscountFils;
      const lineTaxFils = computeInclusiveTax(Math.max(0, lineTotalBeforeTax));
      return {
        productId: item.productId.toString(),
        variantId,
        sku: item.skuSnapshot,
        titleSnapshot: item.titleSnapshot,
        brandSnapshot: item.brandSnapshot,
        imageSnapshot: item.imageSnapshot,
        optionsSnapshot: { ...(item.optionsSnapshot.size ? { size: item.optionsSnapshot.size } : {}), ...(item.optionsSnapshot.color ? { color: item.optionsSnapshot.color } : {}), ...(item.optionsSnapshot.pieceCount ? { pieceCount: item.optionsSnapshot.pieceCount } : {}) },
        stitchingTypeSnapshot: item.stitchingTypeSnapshot,
        articleCodeSnapshot: item.articleCodeSnapshot,
        quantity: item.quantity,
        unitPriceFils: item.unitPriceFils,
        lineDiscountFils,
        lineTaxFils,
        lineTotalFils: Math.max(0, lineTotalBeforeTax),
      };
    });

    const { order, created } = await orderService.createOrderFromCheckout({
      idempotencyKey,
      checkoutSessionId: session._id.toString(),
      userId: actor?.id ?? null,
      guestEmail: actor ? null : session.guestEmail,
      guestPhone: actor ? null : session.shippingAddress.phone.number,
      items,
      subtotalFils: session.subtotalFils,
      discountTotalFils: session.discountFils,
      shippingFils: session.shippingFils,
      codFeeFils: session.codFeeFils,
      taxFils: session.taxFils,
      grandTotalFils: session.grandTotalFils,
      discounts: session.discounts.map((d) => ({ discountId: d.discountId.toString(), code: d.code, type: d.type, amountFils: d.amountFils, appliedTo: d.appliedTo, ...(d.itemId ? { itemId: d.itemId.toString() } : {}) })),
      shippingAddress: { label: session.shippingAddress.label, firstName: session.shippingAddress.firstName, lastName: session.shippingAddress.lastName, phone: session.shippingAddress.phone, emirate: session.shippingAddress.emirate, city: session.shippingAddress.city, area: session.shippingAddress.area, buildingName: session.shippingAddress.buildingName, ...(session.shippingAddress.apartment ? { apartment: session.shippingAddress.apartment } : {}), ...(session.shippingAddress.street ? { street: session.shippingAddress.street } : {}), landmark: session.shippingAddress.landmark, makani: session.shippingAddress.makani, poBox: session.shippingAddress.poBox, country: session.shippingAddress.country, geo: session.shippingAddress.geo },
      billingAddress: { label: session.billingAddress.label, firstName: session.billingAddress.firstName, lastName: session.billingAddress.lastName, phone: session.billingAddress.phone, emirate: session.billingAddress.emirate, city: session.billingAddress.city, area: session.billingAddress.area, buildingName: session.billingAddress.buildingName, ...(session.billingAddress.apartment ? { apartment: session.billingAddress.apartment } : {}), ...(session.billingAddress.street ? { street: session.billingAddress.street } : {}), landmark: session.billingAddress.landmark, makani: session.billingAddress.makani, poBox: session.billingAddress.poBox, country: session.billingAddress.country, geo: session.billingAddress.geo },
      shippingMethod: session.shippingMethod,
      paymentMethod: session.paymentMethod,
      paymentGateway: session.paymentGateway,
      paymentIntentId: session.paymentIntentId,
      codVerifiedAt: session.codVerifiedAt,
      customerNote,
    });

    if (created) {
      await cartService.convertCart(session.cartId);
      for (const item of session.items) {
        await store.clearReserved(session.cartId, item.variantId.toString());
      }
      await repo.markCompleted(session.sessionId, order.id);
    }

    await idempotencyStore.complete(idempotencyKey, order.id);
    return { order, replayed: !created };
  } catch (err) {
    await idempotencyStore.release(idempotencyKey);
    throw err;
  }
}
