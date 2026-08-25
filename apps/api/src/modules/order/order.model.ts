import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type {
  DiscountType,
  Emirate,
  OrderFulfilmentStatus,
  OrderItemFulfilmentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Size,
  StitchingItemStatus,
} from '@lulwah/contracts';

/**
 * Mongoose schema for `orders` — plan.md §7.11. Mirrors `@lulwah/contracts`'
 * `Order` Zod schema field-for-field (so `order.mapper.ts` is a straight
 * copy), plus a handful of internal-only fields that never cross into the
 * public `Order` DTO — same pattern `product.model.ts` uses for
 * `soldCount`/`deletedAt`:
 *
 *  - `invoiceNumber` — plan.md §8.7.3's "generate an invoice number" on
 *    confirmation names an action but not a wire field; `@lulwah/contracts`'
 *    `Order` has none. Kept here, internal-only, format `INV-<orderNumber>`
 *    (see `order.service.ts`) — a documented interpretation, not a literal
 *    plan.md transcription.
 *  - `checkoutSessionId` — traceability back to the `checkout` session an
 *    order was created from; never useful to a client.
 *  - `idempotencyKey` — the `Idempotency-Key` header `checkout`'s `POST
 *    .../place` requires (plan.md §9.5), persisted with a unique index as
 *    the correctness backstop behind the Redis-side check (see `checkout
 *    .service.ts#place`'s doc comment).
 *  - `internalNotes` — `POST /admin/orders/:id/notes` (plan.md §9.7): staff
 *    notes distinct from the customer-facing `statusHistory[].note` trail.
 *
 * **Snapshot rule, stated twice in plan.md for emphasis (§7.11):** every
 * `items[]` entry embeds a full copy of the product/variant at order time.
 * Nothing here is ever populated from `catalog`'s live `ProductModel`/
 * `VariantModel` for display — see `order.service.ts`'s doc comment on
 * building this snapshot once, at checkout, and never re-reading it.
 */

// ---------------------------------------------------------------------------
// Order item
// ---------------------------------------------------------------------------

export interface OrderItemOptionsSnapshotSubdoc {
  size: Size | null;
  color: string | null;
  pieceCount: 1 | 2 | 3 | null;
}

const orderItemOptionsSnapshotSchema = new Schema<OrderItemOptionsSnapshotSubdoc>(
  {
    size: { type: String, default: null },
    color: { type: String, default: null },
    pieceCount: { type: Number, enum: [1, 2, 3, null], default: null },
  },
  { _id: false },
);

export interface OrderItemStitchingSubdoc {
  enabled: boolean;
  measurementSnapshot: Record<string, string | number>;
  priceFils: number;
  status: StitchingItemStatus;
}

const orderItemStitchingSchema = new Schema<OrderItemStitchingSubdoc>(
  {
    enabled: { type: Boolean, required: true },
    measurementSnapshot: { type: Schema.Types.Mixed, default: {} },
    priceFils: { type: Number, required: true },
    status: { type: String, enum: ['queued', 'cutting', 'stitching', 'finishing', 'qc', 'done'], required: true },
  },
  { _id: false },
);

export interface OrderItemSubdoc {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  sku: string;
  titleSnapshot: string;
  brandSnapshot: string;
  imageSnapshot: string;
  optionsSnapshot: OrderItemOptionsSnapshotSubdoc;
  stitchingTypeSnapshot: string;
  articleCodeSnapshot: string;
  quantity: number;
  unitPriceFils: number;
  lineDiscountFils: number;
  lineTaxFils: number;
  lineTotalFils: number;
  stitching: OrderItemStitchingSubdoc | null;
  fulfilmentStatus: OrderItemFulfilmentStatus;
  returnedQty: number;
  refundedFils: number;
}

const orderItemSchema = new Schema<OrderItemSubdoc>(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true },
    titleSnapshot: { type: String, required: true },
    brandSnapshot: { type: String, required: true },
    // Not `required` — see `checkout.model.ts`'s identical field for why.
    imageSnapshot: { type: String, default: '' },
    optionsSnapshot: { type: orderItemOptionsSnapshotSchema, default: () => ({ size: null, color: null, pieceCount: null }) },
    stitchingTypeSnapshot: { type: String, required: true },
    articleCodeSnapshot: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceFils: { type: Number, required: true, min: 0 },
    lineDiscountFils: { type: Number, required: true, default: 0, min: 0 },
    lineTaxFils: { type: Number, required: true, default: 0, min: 0 },
    lineTotalFils: { type: Number, required: true, min: 0 },
    stitching: { type: orderItemStitchingSchema, default: null },
    fulfilmentStatus: {
      type: String,
      enum: ['pending', 'processing', 'stitching', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'],
      required: true,
      default: 'pending',
    },
    returnedQty: { type: Number, required: true, default: 0, min: 0 },
    refundedFils: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: false },
);

// ---------------------------------------------------------------------------
// Status history — plan.md §8.7.4: "immutable"
// ---------------------------------------------------------------------------

export interface OrderStatusHistoryEntrySubdoc {
  from: OrderStatus | null;
  to: OrderStatus;
  at: Date;
  byUserId: string; // ObjectId hex string, OR the literal 'system'
  note: string | undefined;
  notifiedCustomer: boolean;
}

const orderStatusHistoryEntrySchema = new Schema<OrderStatusHistoryEntrySubdoc>(
  {
    from: { type: String, default: null },
    to: { type: String, required: true },
    at: { type: Date, required: true, default: () => new Date() },
    byUserId: { type: String, required: true },
    note: { type: String },
    notifiedCustomer: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// Money / discounts / address / shipping / shipment / payment
// ---------------------------------------------------------------------------

export interface OrderDiscountLineSubdoc {
  discountId: Types.ObjectId;
  code: string | null;
  type: DiscountType;
  amountFils: number;
  appliedTo: 'order' | 'shipping' | 'item';
  itemId: Types.ObjectId | null;
}

const orderDiscountLineSchema = new Schema<OrderDiscountLineSubdoc>(
  {
    discountId: { type: Schema.Types.ObjectId, required: true },
    code: { type: String, default: null },
    type: { type: String, required: true },
    amountFils: { type: Number, required: true, min: 0 },
    appliedTo: { type: String, enum: ['order', 'shipping', 'item'], required: true },
    itemId: { type: Schema.Types.ObjectId, default: null },
  },
  { _id: false },
);

export interface OrderAddressSnapshotSubdoc {
  label: 'home' | 'work' | 'other';
  firstName: string;
  lastName: string;
  phone: { countryCode: '+971'; number: string };
  emirate: Emirate;
  city: string;
  area: string;
  buildingName: string;
  apartment: string | null;
  street: string | null;
  landmark: string;
  makani: string | null;
  poBox: string | null;
  country: 'AE';
  geo: { lat: number; lng: number } | null;
}

const orderAddressSnapshotSchema = new Schema<OrderAddressSnapshotSubdoc>(
  {
    label: { type: String, enum: ['home', 'work', 'other'], required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: {
      type: new Schema({ countryCode: { type: String, enum: ['+971'], required: true }, number: { type: String, required: true } }, { _id: false }),
      required: true,
    },
    emirate: { type: String, required: true },
    city: { type: String, required: true },
    area: { type: String, required: true },
    buildingName: { type: String, required: true },
    apartment: { type: String, default: null },
    street: { type: String, default: null },
    landmark: { type: String, required: true },
    makani: { type: String, default: null },
    poBox: { type: String, default: null },
    country: { type: String, enum: ['AE'], required: true, default: 'AE' },
    geo: { type: new Schema({ lat: Number, lng: Number }, { _id: false }), default: null },
  },
  { _id: false },
);

export interface OrderShippingMethodSubdoc {
  id: string;
  name: string;
  carrier: string;
  etaMinDays: number;
  etaMaxDays: number;
  priceFils: number;
}

const orderShippingMethodSchema = new Schema<OrderShippingMethodSubdoc>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    carrier: { type: String, required: true },
    etaMinDays: { type: Number, required: true },
    etaMaxDays: { type: Number, required: true },
    priceFils: { type: Number, required: true },
  },
  { _id: false },
);

export interface OrderShipmentEventSubdoc {
  code: string;
  description: string;
  at: Date;
  location: string | undefined;
}

const orderShipmentEventSchema = new Schema<OrderShipmentEventSubdoc>(
  { code: { type: String, required: true }, description: { type: String, required: true }, at: { type: Date, required: true }, location: { type: String } },
  { _id: false },
);

export interface OrderShipmentSubdoc {
  _id: Types.ObjectId;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  awb?: string;
  items: { itemId: Types.ObjectId; quantity: number }[];
  shippedAt: Date | null;
  deliveredAt: Date | null;
  events: OrderShipmentEventSubdoc[];
}

const orderShipmentSchema = new Schema<OrderShipmentSubdoc>(
  {
    carrier: { type: String, required: true },
    trackingNumber: { type: String, required: true },
    trackingUrl: { type: String },
    awb: { type: String },
    items: { type: [{ itemId: { type: Schema.Types.ObjectId, required: true }, quantity: { type: Number, required: true } }], default: [] },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    events: { type: [orderShipmentEventSchema], default: [] },
  },
  { timestamps: false },
);

export interface OrderPaymentSubdoc {
  method: PaymentMethod;
  gateway: string | null;
  intentId: string | null;
  transactionIds: string[];
  last4: string | null;
  brand: string | null;
  threeDSResult: string | null;
  codVerifiedAt: Date | null;
}

const orderPaymentSchema = new Schema<OrderPaymentSubdoc>(
  {
    method: { type: String, required: true },
    gateway: { type: String, default: null },
    intentId: { type: String, default: null },
    transactionIds: { type: [String], default: [] },
    last4: { type: String, default: null },
    brand: { type: String, default: null },
    threeDSResult: { type: String, default: null },
    codVerifiedAt: { type: Date, default: null },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// Internal admin notes — `POST /admin/orders/:id/notes` (plan.md §9.7),
// distinct from `statusHistory[].note`'s customer-status-change annotations.
// ---------------------------------------------------------------------------

export interface OrderInternalNoteSubdoc {
  note: string;
  byUserId: Types.ObjectId;
  at: Date;
}

const orderInternalNoteSchema = new Schema<OrderInternalNoteSubdoc>(
  { note: { type: String, required: true }, byUserId: { type: Schema.Types.ObjectId, required: true }, at: { type: Date, required: true, default: () => new Date() } },
  { _id: false },
);

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

export interface OrderDoc {
  _id: Types.ObjectId;
  orderNumber: string;
  userId: Types.ObjectId | null;
  guestEmail: string | null;
  guestPhone: string | null;

  items: Types.DocumentArray<OrderItemSubdoc>;

  currency: 'AED';
  subtotalFils: number;
  discountTotalFils: number;
  shippingFils: number;
  codFeeFils: number;
  taxFils: number;
  taxRate: number;
  taxInclusive: boolean;
  grandTotalFils: number;
  paidFils: number;
  refundedFils: number;
  balanceDueFils: number;

  discounts: OrderDiscountLineSubdoc[];

  status: OrderStatus;
  statusHistory: OrderStatusHistoryEntrySubdoc[];
  paymentStatus: PaymentStatus;
  fulfilmentStatus: OrderFulfilmentStatus;

  shippingAddress: OrderAddressSnapshotSubdoc;
  billingAddress: OrderAddressSnapshotSubdoc;
  shippingMethod: OrderShippingMethodSubdoc;
  shipments: OrderShipmentSubdoc[];

  payment: OrderPaymentSubdoc;

  customerNote: string | undefined;
  tags: string[];

  placedAt: Date;
  confirmedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;

  // Internal-only — see this file's doc comment.
  invoiceNumber: string | null;
  checkoutSessionId: Types.ObjectId | null;
  idempotencyKey: string;
  internalNotes: OrderInternalNoteSubdoc[];

  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<OrderDoc>(
  {
    orderNumber: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    guestEmail: { type: String, default: null },
    guestPhone: { type: String, default: null },

    items: { type: [orderItemSchema], required: true, validate: { validator: (v: unknown[]) => v.length > 0, message: 'An order must have at least one item.' } },

    currency: { type: String, enum: ['AED'], required: true, default: 'AED' },
    subtotalFils: { type: Number, required: true, min: 0 },
    discountTotalFils: { type: Number, required: true, default: 0, min: 0 },
    shippingFils: { type: Number, required: true, default: 0, min: 0 },
    codFeeFils: { type: Number, required: true, default: 0, min: 0 },
    taxFils: { type: Number, required: true, default: 0, min: 0 },
    taxRate: { type: Number, required: true },
    taxInclusive: { type: Boolean, required: true, default: true },
    grandTotalFils: { type: Number, required: true, min: 0 },
    paidFils: { type: Number, required: true, default: 0, min: 0 },
    refundedFils: { type: Number, required: true, default: 0, min: 0 },
    balanceDueFils: { type: Number, required: true, default: 0 },

    discounts: { type: [orderDiscountLineSchema], default: [] },

    status: { type: String, required: true, default: 'pending_payment' },
    statusHistory: { type: [orderStatusHistoryEntrySchema], default: [] },
    paymentStatus: { type: String, enum: ['unpaid', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed'], required: true, default: 'unpaid' },
    fulfilmentStatus: { type: String, enum: ['unfulfilled', 'partially_fulfilled', 'fulfilled', 'returned'], required: true, default: 'unfulfilled' },

    shippingAddress: { type: orderAddressSnapshotSchema, required: true },
    billingAddress: { type: orderAddressSnapshotSchema, required: true },
    shippingMethod: { type: orderShippingMethodSchema, required: true },
    shipments: { type: [orderShipmentSchema], default: [] },

    payment: { type: orderPaymentSchema, required: true },

    customerNote: { type: String },
    tags: { type: [String], default: [] },

    placedAt: { type: Date, required: true, default: () => new Date() },
    confirmedAt: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },

    invoiceNumber: { type: String, default: null },
    checkoutSessionId: { type: Schema.Types.ObjectId, default: null },
    idempotencyKey: { type: String, required: true },
    internalNotes: { type: [orderInternalNoteSchema], default: [] },
  },
  { timestamps: true, collection: 'orders' },
);

// plan.md §7.14-equivalent index list for this model.
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ idempotencyKey: 1 }, { unique: true });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ guestEmail: 1 });
orderSchema.index({ guestPhone: 1 });
orderSchema.index({ 'payment.intentId': 1 });

export type OrderHydratedDoc = HydratedDocument<OrderDoc>;
export const OrderModel = model<OrderDoc>('Order', orderSchema);

// ---------------------------------------------------------------------------
// Counter — plan.md §8.6: order numbers `LF-YYMMDD-NNNN`, generated via an
// atomic `findOneAndUpdate` on this collection, never a naive count query
// (race-prone under concurrent orders). Generic `_id`/`seq` shape so it can
// back any future per-key sequence, not just order numbers.
// ---------------------------------------------------------------------------

export interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({ _id: { type: String, required: true }, seq: { type: Number, required: true, default: 0 } }, { collection: 'counters', versionKey: false });

export const CounterModel = model<CounterDoc>('Counter', counterSchema);
