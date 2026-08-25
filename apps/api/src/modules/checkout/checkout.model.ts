import { randomUUID } from 'node:crypto';
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { DiscountType, Emirate, PaymentMethod, Size } from '@lulwah/contracts';

/**
 * Mongoose schema for `checkout_sessions` — plan.md §9.5. Not in
 * `@lulwah/contracts` (no `CheckoutSession` wire contract exists yet, and
 * this build doesn't touch `apps/web`/`apps/admin`, which are the only
 * consumers that would need one) — this is a purely server-side,
 * `checkout`-owned document, same "module-local response DTO" precedent
 * `cart.dto.ts#CartResponse` sets for a shape that doesn't live in the
 * shared contracts package.
 *
 * A checkout session snapshots prices/product details from the cart at
 * `POST /checkout/session` time (plan.md §9.5: "locks prices") — this is
 * what lets `place` build the final `Order` snapshot (plan.md §7.11)
 * without re-reading `catalog` at that moment, and what `place`'s own
 * "re-validates stock/price one more time" step compares the *current*
 * catalog state against.
 */

export interface CheckoutSessionItemSubdoc {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
  unitPriceFils: number;
  compareAtPriceFils: number | null;
  titleSnapshot: string;
  brandSnapshot: string;
  imageSnapshot: string;
  skuSnapshot: string;
  articleCodeSnapshot: string;
  stitchingTypeSnapshot: string;
  optionsSnapshot: { size: Size | null; color: string | null; pieceCount: 1 | 2 | 3 | null };
}

const checkoutSessionItemSchema = new Schema<CheckoutSessionItemSubdoc>(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceFils: { type: Number, required: true, min: 0 },
    compareAtPriceFils: { type: Number, default: null },
    titleSnapshot: { type: String, required: true },
    brandSnapshot: { type: String, required: true },
    // Not `required` — a real product can legitimately have no media yet
    // (plan.md's own admin editor ships products before photography is
    // attached in some workflows); checkout must not hard-block on that.
    imageSnapshot: { type: String, default: '' },
    skuSnapshot: { type: String, required: true },
    articleCodeSnapshot: { type: String, required: true },
    stitchingTypeSnapshot: { type: String, required: true },
    optionsSnapshot: {
      type: new Schema({ size: { type: String, default: null }, color: { type: String, default: null }, pieceCount: { type: Number, default: null } }, { _id: false }),
      default: () => ({ size: null, color: null, pieceCount: null }),
    },
  },
  { _id: false },
);

export interface CheckoutSessionDiscountSubdoc {
  discountId: Types.ObjectId;
  code: string | null;
  type: DiscountType;
  amountFils: number;
  appliedTo: 'order' | 'shipping' | 'item';
  itemId: Types.ObjectId | null;
}

const checkoutSessionDiscountSchema = new Schema<CheckoutSessionDiscountSubdoc>(
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

export interface CheckoutAddressSnapshotSubdoc {
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

const checkoutAddressSnapshotSchema = new Schema<CheckoutAddressSnapshotSubdoc>(
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

export interface CheckoutShippingMethodSubdoc {
  id: string;
  name: string;
  carrier: string;
  etaMinDays: number;
  etaMaxDays: number;
  priceFils: number;
}

const checkoutShippingMethodSchema = new Schema<CheckoutShippingMethodSubdoc>(
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

export type CheckoutSessionStatus = 'open' | 'completed' | 'expired';

export interface CheckoutSessionDoc {
  _id: Types.ObjectId;
  sessionId: string;
  cartId: string;
  userId: Types.ObjectId | null;
  guestEmail: string | null;
  guestPhone: string | null;

  items: CheckoutSessionItemSubdoc[];

  /** Carried forward from whatever coupon was applied to the cart at
   *  `POST /checkout/session` time (plan.md §8.3: at most one per order) —
   *  `checkout` has no "apply coupon" endpoint of its own (not in plan.md
   *  §9.5's list); this is what `computeSessionPricing` re-resolves
   *  against the discount engine on every subsequent step. */
  couponCode: string | null;

  subtotalFils: number;
  discountFils: number;
  shippingFils: number;
  codFeeFils: number;
  taxFils: number;
  grandTotalFils: number;
  discounts: CheckoutSessionDiscountSubdoc[];

  shippingAddress: CheckoutAddressSnapshotSubdoc | null;
  billingAddress: CheckoutAddressSnapshotSubdoc | null;
  shippingMethod: CheckoutShippingMethodSubdoc | null;

  paymentMethod: PaymentMethod | null;
  paymentGateway: string | null;
  paymentIntentId: string | null;
  codVerifiedAt: Date | null;

  orderId: Types.ObjectId | null;
  status: CheckoutSessionStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const checkoutSessionSchema = new Schema<CheckoutSessionDoc>(
  {
    sessionId: { type: String, required: true, default: () => randomUUID() },
    cartId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    guestEmail: { type: String, default: null },
    guestPhone: { type: String, default: null },

    items: { type: [checkoutSessionItemSchema], default: [] },
    couponCode: { type: String, default: null },

    subtotalFils: { type: Number, required: true, default: 0 },
    discountFils: { type: Number, required: true, default: 0 },
    shippingFils: { type: Number, required: true, default: 0 },
    codFeeFils: { type: Number, required: true, default: 0 },
    taxFils: { type: Number, required: true, default: 0 },
    grandTotalFils: { type: Number, required: true, default: 0 },
    discounts: { type: [checkoutSessionDiscountSchema], default: [] },

    shippingAddress: { type: checkoutAddressSnapshotSchema, default: null },
    billingAddress: { type: checkoutAddressSnapshotSchema, default: null },
    shippingMethod: { type: checkoutShippingMethodSchema, default: null },

    paymentMethod: { type: String, default: null },
    paymentGateway: { type: String, default: null },
    paymentIntentId: { type: String, default: null },
    codVerifiedAt: { type: Date, default: null },

    orderId: { type: Schema.Types.ObjectId, default: null },
    status: { type: String, enum: ['open', 'completed', 'expired'], required: true, default: 'open' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'checkout_sessions' },
);

checkoutSessionSchema.index({ sessionId: 1 }, { unique: true });
checkoutSessionSchema.index({ cartId: 1 });
checkoutSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type CheckoutSessionHydratedDoc = HydratedDocument<CheckoutSessionDoc>;
export const CheckoutSessionModel = model<CheckoutSessionDoc>('CheckoutSession', checkoutSessionSchema);
