import { Types } from 'mongoose';
import type { AddressSnapshot, AdminOrder, DiscountType, Order, OrderStatus, PaymentMethod, Size } from '@lulwah/contracts';
import { AppError } from '../../shared/errors.js';
import { notifyStub } from '../../shared/notify.js';
import { SYSTEM_ACTOR_ID } from '../../config/constants.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as identityService from '../identity/identity.service.js';
import * as inventoryService from '../inventory/inventory.service.js';
import * as pricingService from '../pricing/pricing.service.js';
import * as productService from '../catalog/product.service.js';
import * as paymentService from '../payment/payment.service.js';
import * as repo from './order.repository.js';
import type { AdminOrderListFilter, CreateOrderInput } from './order.repository.js';
import type { OrderDoc, OrderHydratedDoc } from './order.model.js';
import { toAdminOrderDto, toOrderDto, toPublicTrackingView } from './order.mapper.js';
import type { PublicOrderTrackingView } from './order.mapper.js';
import { assertRoleMayMakeTransition, assertValidOrderStatusTransition } from './order.transitions.js';
import { orderEvents } from './order.events.js';
import type { AdminRefundOrderInput, UpdateOrderStatusInput } from './order.dto.js';

/**
 * ALL order business rules live here, framework-free (no `express` — plan.md
 * §5.4). `order.controller.ts` only parses/shapes; `order.repository.ts`
 * only persists.
 */

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

function toOrderAddressSubdoc(a: AddressSnapshot): OrderDoc['shippingAddress'] {
  return {
    label: a.label,
    firstName: a.firstName,
    lastName: a.lastName,
    phone: { countryCode: a.phone.countryCode, number: a.phone.number },
    emirate: a.emirate,
    city: a.city,
    area: a.area,
    buildingName: a.buildingName,
    apartment: a.apartment ?? null,
    street: a.street ?? null,
    landmark: a.landmark,
    makani: a.makani,
    poBox: a.poBox,
    country: a.country,
    geo: a.geo,
  };
}

// ---------------------------------------------------------------------------
// Order creation — `checkout`'s exclusive entry point (plan.md §5.3): never
// `OrderModel` directly, only this function.
// ---------------------------------------------------------------------------

export interface CreateOrderFromCheckoutItemInput {
  productId: string;
  variantId: string;
  sku: string;
  titleSnapshot: string;
  brandSnapshot: string;
  imageSnapshot: string;
  optionsSnapshot: { size?: Size; color?: string; pieceCount?: 1 | 2 | 3 };
  stitchingTypeSnapshot: string;
  articleCodeSnapshot: string;
  quantity: number;
  unitPriceFils: number;
  lineDiscountFils: number;
  lineTaxFils: number;
  lineTotalFils: number;
}

export interface CreateOrderFromCheckoutDiscountInput {
  discountId: string;
  code: string | null;
  type: DiscountType;
  amountFils: number;
  appliedTo: 'order' | 'shipping' | 'item';
  itemId?: string;
}

export interface CreateOrderFromCheckoutInput {
  idempotencyKey: string;
  checkoutSessionId: string;
  userId: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  items: CreateOrderFromCheckoutItemInput[];
  subtotalFils: number;
  discountTotalFils: number;
  shippingFils: number;
  codFeeFils: number;
  taxFils: number;
  /** plan.md §31 Q5: the VAT rate is now DB-backed via `settings`, not a
   *  hardcoded `env.VAT_RATE` — `checkout.service.ts#place` reads it once
   *  from `settings.service.ts#getSettingsSnapshot` and passes it straight
   *  through here rather than `order` taking its own dependency on
   *  `settings` for a single scalar it doesn't otherwise need. */
  taxRate: number;
  grandTotalFils: number;
  discounts: CreateOrderFromCheckoutDiscountInput[];
  shippingAddress: AddressSnapshot;
  billingAddress: AddressSnapshot;
  shippingMethod: { id: string; name: string; carrier: string; etaMinDays: number; etaMaxDays: number; priceFils: number };
  paymentMethod: PaymentMethod;
  paymentGateway: string | null;
  paymentIntentId: string | null;
  codVerifiedAt: Date | null;
  customerNote?: string | undefined;
}

/**
 * `POST /checkout/session/:id/place` (via `checkout.service.ts`). Creates
 * the order snapshot (plan.md §7.11's rule — every field below is a copy,
 * never a reference `catalog` would need to be re-read to resolve) and
 * starts the plan.md §8.7 state machine at `pending_payment`.
 *
 * COD orders auto-advance to `confirmed` immediately (see the doc comment
 * on the `if (input.paymentMethod === 'cod')` branch below) — every other
 * method waits for its payment confirmation (a Ziina webhook, plan.md §20)
 * to make that same transition.
 *
 * `created: false` on the return value means this call was itself a
 * retried request that raced past `checkout`'s Redis-side idempotency
 * check (see `checkout.service.ts#place`'s doc comment) — the
 * `idempotencyKey` unique index on `OrderModel` is the correctness
 * backstop that makes that race harmless: the duplicate insert fails, and
 * the original order (not a second one) is returned instead.
 */
export async function createOrderFromCheckout(input: CreateOrderFromCheckoutInput): Promise<{ order: Order; created: boolean }> {
  const orderNumber = await repo.nextOrderNumber();
  const now = new Date();

  const doc: CreateOrderInput = {
    orderNumber,
    userId: input.userId,
    guestEmail: input.guestEmail,
    guestPhone: input.guestPhone,
    items: input.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      sku: item.sku,
      titleSnapshot: item.titleSnapshot,
      brandSnapshot: item.brandSnapshot,
      imageSnapshot: item.imageSnapshot,
      optionsSnapshot: { size: item.optionsSnapshot.size ?? null, color: item.optionsSnapshot.color ?? null, pieceCount: item.optionsSnapshot.pieceCount ?? null },
      stitchingTypeSnapshot: item.stitchingTypeSnapshot,
      articleCodeSnapshot: item.articleCodeSnapshot,
      quantity: item.quantity,
      unitPriceFils: item.unitPriceFils,
      lineDiscountFils: item.lineDiscountFils,
      lineTaxFils: item.lineTaxFils,
      lineTotalFils: item.lineTotalFils,
      stitching: null,
      fulfilmentStatus: 'pending',
      returnedQty: 0,
      refundedFils: 0,
    })),
    currency: 'AED',
    subtotalFils: input.subtotalFils,
    discountTotalFils: input.discountTotalFils,
    shippingFils: input.shippingFils,
    codFeeFils: input.codFeeFils,
    taxFils: input.taxFils,
    taxRate: input.taxRate,
    taxInclusive: true,
    grandTotalFils: input.grandTotalFils,
    paidFils: 0,
    refundedFils: 0,
    balanceDueFils: input.grandTotalFils,
    discounts: input.discounts.map((d) => ({ discountId: d.discountId, code: d.code, type: d.type, amountFils: d.amountFils, appliedTo: d.appliedTo, itemId: d.itemId ?? null })),
    status: 'pending_payment',
    statusHistory: [{ from: null, to: 'pending_payment', at: now, byUserId: SYSTEM_ACTOR_ID, note: undefined, notifiedCustomer: false }],
    paymentStatus: 'unpaid',
    fulfilmentStatus: 'unfulfilled',
    shippingAddress: toOrderAddressSubdoc(input.shippingAddress),
    billingAddress: toOrderAddressSubdoc(input.billingAddress),
    shippingMethod: input.shippingMethod,
    payment: { method: input.paymentMethod, gateway: input.paymentGateway, intentId: input.paymentIntentId, transactionIds: [], last4: null, brand: null, threeDSResult: null, codVerifiedAt: input.codVerifiedAt },
    customerNote: input.customerNote,
    tags: [],
    placedAt: now,
    confirmedAt: null,
    shippedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    cancelReason: null,
    invoiceNumber: null,
    checkoutSessionId: input.checkoutSessionId,
    idempotencyKey: input.idempotencyKey,
    internalNotes: [],
  };

  let created: OrderHydratedDoc;
  try {
    created = await repo.createOrder(doc);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const existing = await repo.findOrderByIdempotencyKey(input.idempotencyKey);
      if (existing) return { order: toOrderDto(existing), created: false };
    }
    throw err;
  }

  // COD: there is no online payment step to await — the "payment" for a
  // cash-on-delivery order happens physically at the doorstep, and the
  // 6-digit OTP already verified before this call proves the customer's
  // intent to buy. Confirming immediately (rather than sitting at
  // `pending_payment` forever, since nothing will ever complete that
  // payment online) is the documented, deliberate reading of plan.md
  // §8.7's state machine for this payment method. Card/other methods stay
  // `pending_payment` until their gateway confirms — see `payment.service
  // .ts`'s webhook handler.
  if (input.paymentMethod === 'cod') {
    await applyTransition(created, 'confirmed', {
      actorId: SYSTEM_ACTOR_ID,
      isSuperAdminForce: false,
      note: 'COD order — confirmed automatically, no online payment to await.',
      notifyCustomer: true,
    });
  }

  return { order: toOrderDto(created), created: true };
}

// ---------------------------------------------------------------------------
// Status transitions — plan.md §8.7, the state machine.
// ---------------------------------------------------------------------------

interface TransitionOptions {
  actorId: string;
  isSuperAdminForce: boolean;
  note: string | undefined;
  notifyCustomer: boolean;
  trackingNumber?: string | undefined;
  carrier?: string | undefined;
}

const ITEM_STATUS_BY_ORDER_STATUS: Partial<Record<OrderStatus, OrderDoc['items'][number]['fulfilmentStatus']>> = {
  processing: 'processing',
  stitching: 'stitching',
  ready_to_ship: 'packed',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
  returned: 'returned',
};

/** The single place `order.status` ever changes (plan.md §8.7.4:
 *  "immutable" audit trail — every change appends, never edits, a
 *  `statusHistory` entry). Runs the DB-local side effects synchronously
 *  (timestamps, item statuses, a shipment record), then publishes the
 *  cross-module side effects as domain events (plan.md §8.7.3) — see
 *  `order.events.ts`'s doc comment on why those are `await`ed here rather
 *  than fire-and-forget. */
async function applyTransition(order: OrderHydratedDoc, to: OrderStatus, opts: TransitionOptions): Promise<OrderHydratedDoc> {
  const from = order.status;
  assertValidOrderStatusTransition(from, to, { isForcedBySuperAdmin: opts.isSuperAdminForce, reason: opts.note });

  order.status = to;
  order.statusHistory.push({ from, to, at: new Date(), byUserId: opts.actorId, note: opts.note, notifiedCustomer: opts.notifyCustomer });

  const itemStatus = ITEM_STATUS_BY_ORDER_STATUS[to];
  if (itemStatus) {
    for (const item of order.items) item.fulfilmentStatus = itemStatus;
  }

  if (to === 'confirmed') order.confirmedAt = new Date();
  if (to === 'shipped') {
    order.shippedAt = new Date();
    order.fulfilmentStatus = 'fulfilled';
    if (opts.trackingNumber && opts.carrier) {
      order.shipments.push({
        _id: new Types.ObjectId(),
        carrier: opts.carrier,
        trackingNumber: opts.trackingNumber,
        items: order.items.map((i) => ({ itemId: i._id, quantity: i.quantity })),
        shippedAt: new Date(),
        deliveredAt: null,
        events: [],
      });
    }
  }
  if (to === 'delivered') order.deliveredAt = new Date();
  if (to === 'cancelled') {
    order.cancelledAt = new Date();
    order.cancelReason = opts.note ?? null;
  }
  if (to === 'returned') order.fulfilmentStatus = 'returned';

  await repo.save(order);

  const orderId = order._id.toString();
  if (to === 'confirmed') await orderEvents.publish('order.confirmed', { orderId });
  if (to === 'cancelled') await orderEvents.publish('order.cancelled', { orderId });
  if (to === 'delivered') await orderEvents.publish('order.delivered', { orderId });
  await orderEvents.publish('order.status_changed', { orderId, orderNumber: order.orderNumber, from, to, notifyCustomer: opts.notifyCustomer });

  // A real bug this module's own refund-endpoint test caught: `order
  // .confirmed`/`order.delivered`'s listeners (above) each fetch their OWN
  // copy of the order and persist further field writes on it (invoice
  // number; COD's `paymentStatus -> 'paid'` on delivery) — writes that
  // never touch this function's own in-memory `order`. The database was
  // always correct; only the DTO this function returned (and therefore
  // `PATCH /admin/orders/:id/status`'s HTTP response body) was stale,
  // which matters for exactly the case `order.service.ts#refundOrder`
  // cares about: a caller deciding whether an order is refundable from
  // the status-transition response it just received. Cheap to re-fetch
  // (a single indexed findOne by `_id`) rather than threading every
  // listener's field writes back through this function by hand.
  const fresh = await repo.findOrderById(orderId);
  return fresh ?? order;
}

/** `PATCH /admin/orders/:id/status` — plan.md §9.7, the status flag
 *  endpoint the admin UI's `StatusTransitionDropdown` calls.
 *  `super_admin` may force any transition outside `order.transitions.ts`'s
 *  table (audited, with the mandatory reason `assertValidOrderStatusTransition`
 *  enforces) — every other role is constrained to it. */
export async function updateOrderStatus(actor: AuthenticatedUser, orderId: string, input: UpdateOrderStatusInput): Promise<AdminOrder> {
  assertPermission(actor, 'orders.status.update');
  const order = await repo.findOrderById(orderId);
  if (!order) throw new AppError('ORDER_NOT_FOUND', 404, { messageEn: 'Order not found.' });

  // plan.md §10.2's `✏️*` footnote: `warehouse`/`support` hold the same
  // `orders.status.update` permission string as `manager`/`order_ops`, but
  // may only drive a restricted subset of the table — a distinction the
  // permission string itself can't express, so it's enforced here, on top
  // of (never instead of) the base table check `applyTransition` still
  // runs below. No-op for every other role, `super_admin`'s force path
  // included.
  assertRoleMayMakeTransition(actor.role, order.status, input.status);

  const updated = await applyTransition(order, input.status, {
    actorId: actor.id,
    isSuperAdminForce: actor.role === 'super_admin',
    note: input.note,
    notifyCustomer: input.notifyCustomer,
    trackingNumber: input.trackingNumber,
    carrier: input.carrier,
  });
  return toAdminOrderDto(updated);
}

/**
 * `payment` module's exclusive entry point for its Ziina webhook handler
 * (plan.md §5.3, §9.6) — never `OrderModel` directly. Records the card
 * charge's outcome on `payment`/money fields (which the generic
 * `applyTransition` doesn't know how to touch — a webhook is the one place
 * this codebase learns a card charge actually settled) and drives the
 * matching `pending_payment → confirmed` / `pending_payment → failed`
 * transition in one step, so `order.confirmed`'s side effects (stock
 * commit, invoice number, discount usage) fire exactly the same way they
 * do for a COD order's auto-confirmation.
 */
export async function recordCardPaymentResult(paymentIntentId: string, result: 'succeeded' | 'failed', chargeId?: string): Promise<Order | null> {
  const order = await repo.findOrderByPaymentIntentId(paymentIntentId);
  if (!order) return null;
  // Idempotent against a re-delivered webhook for the same event: once the
  // order has left `pending_payment`, there is nothing left for this
  // function to do (a valid transition is required either way — a second
  // "succeeded" webhook attempting `pending_payment → confirmed` on an
  // already-`confirmed` order would fail `assertValidOrderStatusTransition`
  // otherwise, unnecessarily). `payment.service.ts`'s webhook idempotency
  // store is the primary guard; this is a second, cheap line of defense.
  if (order.status !== 'pending_payment') return toOrderDto(order);

  if (result === 'succeeded') {
    order.paymentStatus = 'paid';
    order.paidFils = order.grandTotalFils;
    order.balanceDueFils = 0;
    if (chargeId) order.payment.transactionIds.push(chargeId);
    await repo.save(order);
    const updated = await applyTransition(order, 'confirmed', { actorId: SYSTEM_ACTOR_ID, isSuperAdminForce: false, note: 'Card payment confirmed (Ziina).', notifyCustomer: true });
    return toOrderDto(updated);
  }

  order.paymentStatus = 'failed';
  await repo.save(order);
  const updated = await applyTransition(order, 'failed', { actorId: SYSTEM_ACTOR_ID, isSuperAdminForce: false, note: 'Card payment failed (Ziina).', notifyCustomer: true });
  return toOrderDto(updated);
}

/** Internal system-driven transition — `payment` module's Ziina webhook
 *  handler calls this to move a card order `pending_payment → confirmed`
 *  (payment succeeded) or `pending_payment → failed` (payment failed),
 *  attributed to `SYSTEM_ACTOR_ID` (plan.md's own sentinel for exactly
 *  this — see `config/constants.ts`). Not exposed over HTTP. */
export async function transitionOrderStatusAsSystem(orderId: string, to: OrderStatus, note: string): Promise<Order | null> {
  const order = await repo.findOrderById(orderId);
  if (!order) return null;
  const updated = await applyTransition(order, to, { actorId: SYSTEM_ACTOR_ID, isSuperAdminForce: false, note, notifyCustomer: true });
  return toOrderDto(updated);
}

// ---------------------------------------------------------------------------
// Side-effect listeners — plan.md §8.7.3. Registered once, at module load,
// right alongside the transition function that publishes them (the
// structural separation plan.md's "not inline" asks for — see `order
// .events.ts`'s doc comment).
// ---------------------------------------------------------------------------

orderEvents.subscribe('order.confirmed', async ({ orderId }) => {
  const order = await repo.findOrderById(orderId);
  if (!order) return;

  for (const item of order.items) {
    await inventoryService.commitReservedSale({ variantId: item.variantId.toString(), quantity: item.quantity, reference: order.orderNumber });
  }

  order.invoiceNumber = `INV-${order.orderNumber}`;

  const discountIds = new Set(order.discounts.map((d) => d.discountId.toString()));
  for (const id of discountIds) await pricingService.incrementDiscountUsage(id);

  for (const item of order.items) await productService.incrementSoldCount(item.productId.toString(), item.quantity);

  await repo.save(order);
});

orderEvents.subscribe('order.cancelled', async ({ orderId }) => {
  const order = await repo.findOrderById(orderId);
  if (!order) return;

  // A sale was only ever committed once the order reached `confirmed` (see
  // `applyTransition`'s `confirmedAt` write) — a cancellation before that
  // point (still `pending_payment`) never converted the reservation, so it
  // only needs releasing, not reversing.
  const saleWasCommitted = order.confirmedAt !== null;
  for (const item of order.items) {
    if (saleWasCommitted) {
      await inventoryService.restockCancelledSale({ variantId: item.variantId.toString(), quantity: item.quantity, reference: order.orderNumber });
    } else {
      await inventoryService.releaseStock({ variantId: item.variantId.toString(), quantity: item.quantity, reference: order.orderNumber });
    }
  }

  const discountIds = new Set(order.discounts.map((d) => d.discountId.toString()));
  for (const id of discountIds) await pricingService.decrementDiscountUsage(id);
});

orderEvents.subscribe('order.delivered', async ({ orderId }) => {
  const order = await repo.findOrderById(orderId);
  if (!order) return;
  // COD: cash is collected at the door on delivery — this is the moment
  // that payment is actually settled. Card payments were already marked
  // `paid` when the gateway confirmed (see `payment.service.ts`).
  if (order.payment.method === 'cod' && order.paymentStatus !== 'paid') {
    order.paymentStatus = 'paid';
    order.paidFils = order.grandTotalFils;
    order.balanceDueFils = 0;
    await repo.save(order);
  }
});

orderEvents.subscribe('order.status_changed', async ({ orderId, orderNumber, to, notifyCustomer }) => {
  if (!notifyCustomer) return;
  const order = await repo.findOrderById(orderId);
  if (!order) return;

  let email = order.guestEmail;
  let phone = order.guestPhone;
  if (order.userId) {
    const user = await identityService.me(order.userId.toString()).catch(() => null);
    email = email ?? user?.email ?? null;
    phone = phone ?? user?.phone?.number ?? null;
  }

  if (email) notifyStub({ channel: 'email', to: email, template: `order-status-${to}`, data: { orderNumber, status: to } });
  if (phone) notifyStub({ channel: 'sms', to: phone, template: `order-status-${to}`, data: { orderNumber, status: to } });
});

// ---------------------------------------------------------------------------
// Reads — admin (plan.md §9.7) + customer-facing (`/me`, guest tracking).
// ---------------------------------------------------------------------------

export async function adminListOrders(actor: AuthenticatedUser, filter: AdminOrderListFilter, page: number, limit: number): Promise<{ orders: AdminOrder[]; total: number }> {
  assertPermission(actor, 'orders.read');
  const { orders, total } = await repo.adminListOrders(filter, page, limit);
  return { orders: orders.map(toAdminOrderDto), total };
}

export async function adminGetOrder(actor: AuthenticatedUser, id: string): Promise<AdminOrder> {
  assertPermission(actor, 'orders.read');
  const order = await repo.findOrderById(id);
  if (!order) throw new AppError('ORDER_NOT_FOUND', 404, { messageEn: 'Order not found.' });
  return toAdminOrderDto(order);
}

/** `POST /admin/orders/:id/notes` — plan.md §9.7. Internal-only, never
 *  visible to the customer (see `order.model.ts`'s `internalNotes` doc
 *  comment). Returns `AdminOrder` (not `Order`) so the note just written
 *  is actually readable in the response — see `AdminOrder`'s own doc
 *  comment in `@lulwah/contracts` for the P3 bug this fixes: previously
 *  every admin order-read endpoint used the customer-facing `toOrderDto`,
 *  which strips `internalNotes` entirely, so a note posted here could
 *  never be read back through any endpoint. */
export async function addAdminNote(actor: AuthenticatedUser, id: string, note: string): Promise<AdminOrder> {
  assertPermission(actor, 'orders.status.update');
  const order = await repo.findOrderById(id);
  if (!order) throw new AppError('ORDER_NOT_FOUND', 404, { messageEn: 'Order not found.' });
  order.internalNotes.push({ note, byUserId: new Types.ObjectId(actor.id), at: new Date() });
  await repo.save(order);
  return toAdminOrderDto(order);
}

/**
 * `POST /admin/orders/:id/refund` — plan.md §8.8. Requires `refunds.write`
 * (already declared in `identity.policy.ts`'s `PERMISSIONS` list — route-
 * level `requireOrderRefund()` gates it too, this is the service-layer
 * re-check plan.md §10.2 asks every permission-gated action to have).
 *
 * Resolves "amount omitted = full refund" here (not in `payment.service
 * .ts` or the gateway) because this is the one layer that actually has
 * `order.paidFils`/`refundedFils` to compute "what's still refundable"
 * from — `payment.service.ts#refundOrder`/`PaymentGateway#refund` both
 * always receive a concrete integer, so neither needed a "no amount means
 * full" branch of their own.
 *
 * Money/`paymentStatus` bookkeeping (judgment call, since plan.md doesn't
 * spell out the exact formula): `refundedFils` accumulates every non-
 * `failed` refund. `balanceDueFils` (a `SignedFils` — see
 * `packages/contracts/src/money.ts`) is deliberately left untouched by a
 * refund — a first attempt at this recomputed it as
 * `grandTotalFils - paidFils - refundedFils`, but that double-counts the
 * refund: a refund symmetrically reduces both what was effectively *owed*
 * (`grandTotalFils - refundedFils`) and what was effectively *paid*
 * (`paidFils - refundedFils`) by the same amount, so it cancels out of
 * "owed minus paid" entirely — `(grandTotalFils - refundedFils) -
 * (paidFils - refundedFils)` is just `grandTotalFils - paidFils`, refunds
 * or not. `balanceDueFils` stays whatever it was set to at payment capture
 * (0, once fully paid — see `recordCardPaymentResult`/the `order.delivered`
 * listener above) for the same reason a $50 refund on a fully-paid order
 * doesn't leave the customer owing (or being owed) anything further once
 * the refund transfer itself has happened: the money already moved via
 * the gateway call above, `refundedFils`/`paymentStatus` are what record
 * that it did. `SignedFils` stays the field's type regardless (an
 * existing capability — e.g. a manual overpayment adjustment elsewhere —
 * not one this function needs to newly exercise). `paymentStatus` follows
 * `refundedFils` against `paidFils` (not `grandTotalFils` — a partially-
 * paid order can't be "fully refunded" by refunding only what it actually
 * paid).
 *
 * A gateway response of `status: 'failed'` is still recorded in
 * `order.refunds[]` (the immutable audit trail — a failed attempt is real
 * history, not discarded) but never touches the money fields above. There
 * is no Ziina webhook for refund-status changes (only
 * `payment_intent.status.updated` is documented) and this build doesn't
 * poll `GET /refund/{id}`, so a gateway `'pending'` response is treated the
 * same as `'completed'` here — the money is considered on its way back the
 * moment Ziina accepts the request. Documented as a known gap, not silently
 * assumed correct.
 */
export async function refundOrder(actor: AuthenticatedUser, orderId: string, input: AdminRefundOrderInput): Promise<AdminOrder> {
  assertPermission(actor, 'refunds.write');
  const order = await repo.findOrderById(orderId);
  if (!order) throw new AppError('ORDER_NOT_FOUND', 404, { messageEn: 'Order not found.' });

  if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partially_refunded') {
    throw new AppError('CONFLICT', 409, { messageEn: 'This order has no captured payment to refund.' });
  }

  const refundableFils = order.paidFils - order.refundedFils;
  const amountFils = input.amountFils ?? refundableFils;
  if (amountFils <= 0 || amountFils > refundableFils) {
    throw new AppError('CONFLICT', 409, {
      messageEn: 'Refund amount must be greater than zero and cannot exceed the amount still refundable.',
      details: { refundableFils },
    });
  }

  const result = await paymentService.refundOrder({ method: order.payment.method, gateway: order.payment.gateway, intentId: order.payment.intentId }, amountFils, input.reason);
  const status: 'pending' | 'completed' | 'failed' = result.status === 'failed' ? 'failed' : result.status === 'pending' ? 'pending' : 'completed';

  order.refunds.push({
    amountFils,
    reason: input.reason,
    status,
    gatewayRefundId: result.refundId,
    byUserId: new Types.ObjectId(actor.id),
    at: new Date(),
  } as OrderDoc['refunds'][number]);

  if (status !== 'failed') {
    order.refundedFils += amountFils;
    order.paymentStatus = order.refundedFils >= order.paidFils ? 'refunded' : 'partially_refunded';
  }

  await repo.save(order);
  return toAdminOrderDto(order);
}

/**
 * `checkout`'s exclusive read for idempotent `place` replays (plan.md
 * §9.5) — see `checkout.service.ts#place`'s doc comment. Re-derives from
 * Mongo's own unique index rather than trusting Redis's cached id blindly,
 * so a stale/lost Redis record can never point a replay at the wrong (or a
 * no-longer-existent) order.
 */
export async function getOrderByIdempotencyKey(key: string): Promise<Order | null> {
  const order = await repo.findOrderByIdempotencyKey(key);
  return order ? toOrderDto(order) : null;
}

/** `checkout`'s exclusive read for the discount engine's `isFirstOrder`
 *  condition (plan.md §8.3) — cart-phase computes this defensively as
 *  `false` (no `order` module existed yet to ask); `checkout`/`place` can
 *  finally answer it for real. */
export async function hasPriorOrders(userId: string): Promise<boolean> {
  const { total } = await repo.listOrdersForUser(userId, 1, 1);
  return total > 0;
}

export async function getMyOrders(userId: string, page: number, limit: number): Promise<{ orders: Order[]; total: number }> {
  const { orders, total } = await repo.listOrdersForUser(userId, page, limit);
  return { orders: orders.map(toOrderDto), total };
}

export async function getMyOrderByNumber(userId: string, orderNumber: string): Promise<Order> {
  const order = await repo.findOrderByOrderNumberForUser(orderNumber, userId);
  if (!order) throw new AppError('ORDER_NOT_FOUND', 404, { messageEn: 'Order not found.' });
  return toOrderDto(order);
}

// ---------------------------------------------------------------------------
// Customer aggregates — `customer` module's exclusive read for plan.md
// §11.1's Customers list/detail (plan.md §5.3: never `OrderModel`
// directly).
// ---------------------------------------------------------------------------

export interface CustomerOrderStats {
  orderCount: number;
  totalSpentFils: number;
  avgOrderValueFils: number;
  lastOrderAt: Date | null;
}

function toCustomerOrderStats(raw: { orderCount: number; totalSpentFils: number; lastOrderAt: Date | null } | undefined): CustomerOrderStats {
  const orderCount = raw?.orderCount ?? 0;
  const totalSpentFils = raw?.totalSpentFils ?? 0;
  return {
    orderCount,
    totalSpentFils,
    avgOrderValueFils: orderCount > 0 ? Math.round(totalSpentFils / orderCount) : 0,
    lastOrderAt: raw?.lastOrderAt ?? null,
  };
}

/** plan.md §7.1's `User.stats` fields exist for exactly this shape
 *  (`orderCount`/`totalSpentFils`/`avgOrderValueFils`/`lastOrderAt`), but
 *  nothing keeps them live yet (see `identity.model.ts`'s own doc comment:
 *  "nothing writes to them yet") — so this computes them live from real
 *  order data on every call rather than trusting a stale persisted zero.
 *  See `order.repository.ts#getOrderStatsForUsers`'s doc comment for
 *  exactly which order statuses count as "spend". */
export async function getCustomerOrderStats(actor: AuthenticatedUser, userId: string): Promise<CustomerOrderStats> {
  assertPermission(actor, 'orders.read');
  const stats = await repo.getOrderStatsForUsers([userId]);
  return toCustomerOrderStats(stats.get(userId));
}

/** Bulk form of the above — one aggregate query for a whole admin list
 *  page (or a bounded sort-scan batch) instead of N+1. */
export async function getCustomerOrderStatsBulk(actor: AuthenticatedUser, userIds: string[]): Promise<Map<string, CustomerOrderStats>> {
  assertPermission(actor, 'orders.read');
  const stats = await repo.getOrderStatsForUsers(userIds);
  return new Map(userIds.map((id) => [id, toCustomerOrderStats(stats.get(id))]));
}

/** plan.md §11.1's "COD risk flags" — see `@lulwah/contracts`' `CustomerCodRisk`
 *  doc comment for why this is a real-data-derived signal, not a
 *  fabricated score. `taggedRisky` is not this function's concern (it
 *  reads `User.tags`, not `Order` — `customer.service.ts` folds it in). */
export async function getCustomerCodRisk(actor: AuthenticatedUser, userId: string): Promise<{ codOrdersPlaced: number; codOrdersCancelled: number; cancelledRate: number }> {
  assertPermission(actor, 'orders.read');
  const { codOrdersPlaced, codOrdersCancelled } = await repo.getCodRiskForUser(userId);
  return { codOrdersPlaced, codOrdersCancelled, cancelledRate: codOrdersPlaced > 0 ? codOrdersCancelled / codOrdersPlaced : 0 };
}

/**
 * `engagement` module's exclusive read for `POST /me/reviews`'s
 * server-side "isVerifiedPurchase" check (plan.md §5.3: never `OrderModel`
 * directly) — a narrow, deliberate extension of this module, same category
 * as `hasPriorOrders`/`getActiveCartForUser`-style additions above made for
 * another module's sake. No `assertPermission` here: this is a self-service
 * check on the caller's own purchase history (`review.service.ts` always
 * calls it with the review-submitter's own `userId`), the same trust
 * `cart.service.ts#recalculate` already extends to `identityService.me()`.
 *
 * "Completed" is read as `delivered`, not any post-payment status
 * (`order.repository.ts#SPEND_COUNTED_STATUSES` counts `confirmed` onward
 * toward spend/LTV — a different question). `Review.fitFeedback` asks how
 * the garment actually fit, which nobody can honestly answer before
 * physically receiving it, so `delivered` is the only bar this codebase
 * treats as a genuine, review-worthy completed purchase.
 */
export async function findDeliveredOrderForProduct(userId: string, productId: string): Promise<string | null> {
  const result = await repo.findDeliveredOrderForUserAndProduct(userId, productId);
  return result?.orderId ?? null;
}

/** `GET /orders/track` — plan.md §8.7.5. No login: the order number plus
 *  the email/phone on file together stand in for authentication. Rate-
 *  limited at the router (`order.routes.ts`, reusing `shared/rate-limit.ts`)
 *  so this can't be used to brute-force either fact. */
export async function trackOrder(orderNumber: string, emailOrPhone: string): Promise<PublicOrderTrackingView> {
  const order = await repo.findOrderByOrderNumber(orderNumber);
  const notFound = () => new AppError('ORDER_NOT_FOUND', 404, { messageEn: 'We could not find an order matching those details.' });
  if (!order) throw notFound();

  let email = order.guestEmail;
  let phone = order.guestPhone;
  if (order.userId) {
    const user = await identityService.me(order.userId.toString()).catch(() => null);
    email = email ?? user?.email ?? null;
    phone = phone ?? user?.phone?.number ?? null;
  }

  const needle = emailOrPhone.trim().toLowerCase();
  const matches = (email && email.toLowerCase() === needle) || (phone && phone.toLowerCase() === needle);
  if (!matches) throw notFound();

  return toPublicTrackingView(order);
}
