import { z } from 'zod';
import { AddressSnapshot } from './address.js';
import { objectId } from './common.js';
import { DiscountType, OrderStatus, PaymentMethod, PaymentStatus, Size } from './enums.js';
import { Fils, SignedFils } from './money.js';

/**
 * `OrderStatus` is defined once, in `enums.ts` (plan.md §32 Appendix A) —
 * re-imported here rather than redeclared, to keep a single canonical
 * export in the package's barrel. It is exactly the enum given in plan.md
 * §6.1's example of the contracts pattern.
 */
export { OrderStatus };

/** Reproduced verbatim from plan.md §6.1 — the canonical example of the
 *  contracts pattern (Zod schema → inferred TS type, shared front+back).
 *  A status can never be added on the backend and forgotten in the admin
 *  dropdown: the compiler stops it. */
export const UpdateOrderStatusInput = z.object({
  status: OrderStatus,
  note: z.string().max(500).optional(),
  notifyCustomer: z.boolean().default(true),
  trackingNumber: z.string().optional(),
  carrier: z.enum(['aramex', 'emirates_post', 'careem', 'fetchr', 'own_fleet']).optional(),
});
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusInput>;

/** plan.md §8.9 Custom stitching — the tailor-workflow kanban states. */
export const StitchingItemStatus = z.enum(['queued', 'cutting', 'stitching', 'finishing', 'qc', 'done']);
export type StitchingItemStatus = z.infer<typeof StitchingItemStatus>;

export const OrderItemFulfilmentStatus = z.enum([
  'pending',
  'processing',
  'stitching',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
]);
export type OrderItemFulfilmentStatus = z.infer<typeof OrderItemFulfilmentStatus>;

export const OrderItemOptionsSnapshot = z.object({
  size: Size.optional(),
  color: z.string().optional(),
  pieceCount: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});
export type OrderItemOptionsSnapshot = z.infer<typeof OrderItemOptionsSnapshot>;

export const OrderItemStitching = z.object({
  enabled: z.boolean(),
  measurementSnapshot: z.record(z.string(), z.union([z.string(), z.number()])),
  priceFils: Fils,
  status: StitchingItemStatus,
});
export type OrderItemStitching = z.infer<typeof OrderItemStitching>;

/** One order line — a full snapshot at order time. Never repopulated from
 *  the live product/variant: if a product is renamed or repriced later,
 *  the 2026 invoice must still be correct (plan.md §7.11 "Snapshot rule"). */
export const OrderItem = z.object({
  id: objectId,
  productId: objectId,
  variantId: objectId,
  sku: z.string(),
  titleSnapshot: z.string(),
  brandSnapshot: z.string(),
  imageSnapshot: z.string(),
  optionsSnapshot: OrderItemOptionsSnapshot,
  stitchingTypeSnapshot: z.string(),
  articleCodeSnapshot: z.string(),
  quantity: z.number().int().positive(),
  unitPriceFils: Fils,
  lineDiscountFils: Fils,
  lineTaxFils: Fils,
  lineTotalFils: Fils,
  stitching: OrderItemStitching.nullable(),
  fulfilmentStatus: OrderItemFulfilmentStatus,
  returnedQty: z.number().int().nonnegative(),
  refundedFils: Fils,
});
export type OrderItem = z.infer<typeof OrderItem>;

/** Immutable audit trail of every status change — plan.md §8.7.4: "Every
 *  change appends to `statusHistory` with actor, timestamp, note, and
 *  whether the customer was notified. This history is immutable." */
export const OrderStatusHistoryEntry = z.object({
  from: OrderStatus.nullable(),
  to: OrderStatus,
  at: z.coerce.date(),
  byUserId: z.union([objectId, z.literal('system')]),
  note: z.string().optional(),
  notifiedCustomer: z.boolean(),
});
export type OrderStatusHistoryEntry = z.infer<typeof OrderStatusHistoryEntry>;

export const OrderDiscountLine = z.object({
  discountId: objectId,
  code: z.string().nullable(),
  type: DiscountType,
  amountFils: Fils,
  appliedTo: z.enum(['order', 'shipping', 'item']),
  itemId: objectId.optional(),
});
export type OrderDiscountLine = z.infer<typeof OrderDiscountLine>;

export const OrderShippingMethod = z.object({
  // Not a Mongo ref: plan.md §21 ships R1 shipping as a flat per-emirate
  // rate table (`checkout/shipping-rates.ts`), not a `shipping_zones`
  // collection, so this is a stable string identifier ('standard') rather
  // than an ObjectId. The Mongoose schema (`order.model.ts`) already
  // types this field as a plain String; this was a contract-only mismatch
  // that made every real order's shippingMethod fail strict validation on
  // any client that actually parses the response against this schema.
  id: z.string(),
  name: z.string(),
  carrier: z.string(),
  etaMinDays: z.number().int().nonnegative(),
  etaMaxDays: z.number().int().nonnegative(),
  priceFils: Fils,
});
export type OrderShippingMethod = z.infer<typeof OrderShippingMethod>;

export const OrderShipmentEvent = z.object({
  code: z.string(),
  description: z.string(),
  at: z.coerce.date(),
  location: z.string().optional(),
});
export type OrderShipmentEvent = z.infer<typeof OrderShipmentEvent>;

export const OrderShipment = z.object({
  id: objectId,
  carrier: z.string(),
  trackingNumber: z.string(),
  trackingUrl: z.string().optional(),
  awb: z.string().optional(),
  items: z.array(z.object({ itemId: objectId, quantity: z.number().int().positive() })),
  shippedAt: z.coerce.date().nullable(),
  deliveredAt: z.coerce.date().nullable(),
  events: z.array(OrderShipmentEvent),
});
export type OrderShipment = z.infer<typeof OrderShipment>;

export const OrderPayment = z.object({
  method: PaymentMethod,
  gateway: z.string().nullable(),
  intentId: z.string().nullable(),
  transactionIds: z.array(z.string()),
  last4: z.string().nullable(),
  brand: z.string().nullable(),
  threeDSResult: z.string().nullable(),
  codVerifiedAt: z.coerce.date().nullable(),
});
export type OrderPayment = z.infer<typeof OrderPayment>;

export const OrderFulfilmentStatus = z.enum(['unfulfilled', 'partially_fulfilled', 'fulfilled', 'returned']);
export type OrderFulfilmentStatus = z.infer<typeof OrderFulfilmentStatus>;

/** plan.md §8.8 Returns & refunds. One entry per refund *attempt* — an
 *  immutable audit trail, the same "append, never edit" convention
 *  `OrderStatusHistoryEntry` sets (§8.7.4). A `failed` entry is kept (not
 *  discarded) so a retried refund attempt is visible in the trail; only a
 *  `pending`/`completed` entry ever moves `Order.refundedFils`/
 *  `paymentStatus` (see `order.service.ts#refundOrder`). `status` is a
 *  small closed union we control, not the gateway's own free-form refund
 *  status string (Ziina: `pending|completed|failed`; Stripe/other
 *  gateways may differ) — `payment.service.ts` normalizes into this. */
export const OrderRefund = z.object({
  id: objectId,
  amountFils: Fils,
  reason: z.string().max(500).optional(),
  status: z.enum(['pending', 'completed', 'failed']),
  /** The gateway's own refund id (e.g. Ziina's `re_...`-shaped `id`), for
   *  support/reconciliation — `null` for a gateway with no such concept
   *  (COD's logged no-op, see `cod.gateway.ts#refund`). */
  gatewayRefundId: z.string().nullable(),
  byUserId: objectId,
  at: z.coerce.date(),
});
export type OrderRefund = z.infer<typeof OrderRefund>;

/** Order — plan.md §7.11. Money is stored, never recomputed at read time. */
export const Order = z.object({
  id: objectId,
  orderNumber: z.string().regex(/^LF-\d{6}-\d{4}$/), // 'LF-260812-0043' — §8.6
  userId: objectId.nullable(),
  guestEmail: z.string().email().nullable(),
  guestPhone: z.string().nullable(),

  items: z.array(OrderItem).min(1),

  // Money — every field stored, nothing recomputed at read time (§7.11)
  currency: z.literal('AED'),
  subtotalFils: Fils,
  discountTotalFils: Fils,
  shippingFils: Fils,
  codFeeFils: Fils,
  taxFils: Fils,
  taxRate: z.number(),
  taxInclusive: z.boolean(),
  grandTotalFils: Fils,
  paidFils: Fils,
  refundedFils: Fils,
  balanceDueFils: SignedFils,

  discounts: z.array(OrderDiscountLine),

  // THE STATUS FLAG — plan.md §8.7
  status: OrderStatus,
  statusHistory: z.array(OrderStatusHistoryEntry),
  paymentStatus: PaymentStatus,
  fulfilmentStatus: OrderFulfilmentStatus,

  shippingAddress: AddressSnapshot, // embedded snapshot, NOT a ref
  billingAddress: AddressSnapshot,
  shippingMethod: OrderShippingMethod,
  shipments: z.array(OrderShipment),

  payment: OrderPayment,
  refunds: z.array(OrderRefund),

  customerNote: z.string().optional(),
  tags: z.array(z.string()),

  placedAt: z.coerce.date(),
  confirmedAt: z.coerce.date().nullable(),
  shippedAt: z.coerce.date().nullable(),
  deliveredAt: z.coerce.date().nullable(),
  cancelledAt: z.coerce.date().nullable(),
  cancelReason: z.string().nullable(),
});
export type Order = z.infer<typeof Order>;
