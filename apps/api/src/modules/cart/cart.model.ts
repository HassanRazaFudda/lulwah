import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * Mongoose schema for `carts` — plan.md §7.10. Mirrors `@lulwah/contracts`'
 * `Cart`/`CartItem` Zod schema field-for-field (so `cart.mapper.ts` is a
 * straight copy), plus `deletedAt`-style internal fields none of this
 * phase needs. `stitching` is kept on the item subdocument for shape
 * parity with the contract but is always `null` in this phase — no
 * `measurement_profiles` module exists yet for a real value to come from
 * (plan.md §7.13, explicitly out of this workstream's scope).
 *
 * `cartId` (a uuid, carried in the `lulwah_cart` cookie — plan.md §8.5) is
 * the external primary key every route/repository function looks up by;
 * Mongo's own `_id` is never exposed on the wire for a cart.
 */

export interface CartItemStitchingSubdoc {
  enabled: boolean;
  measurementProfileId: Types.ObjectId | null;
  priceFils: number;
  leadDays: number;
}

const cartItemStitchingSchema = new Schema<CartItemStitchingSubdoc>(
  {
    enabled: { type: Boolean, required: true },
    measurementProfileId: { type: Schema.Types.ObjectId, default: null },
    priceFils: { type: Number, required: true },
    leadDays: { type: Number, required: true },
  },
  { _id: false },
);

export interface CartItemDoc {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
  unitPriceFils: number;
  compareAtPriceFils: number | null;
  stitching: CartItemStitchingSubdoc | null;
  giftWrap: boolean;
  addedAt: Date;
  priceLockedUntil: Date;
}

const cartItemSchema = new Schema<CartItemDoc>(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceFils: { type: Number, required: true, min: 0 },
    compareAtPriceFils: { type: Number, default: null },
    stitching: { type: cartItemStitchingSchema, default: null },
    giftWrap: { type: Boolean, default: false },
    addedAt: { type: Date, required: true, default: () => new Date() },
    priceLockedUntil: { type: Date, required: true },
  },
  { timestamps: false },
);

export interface CartAppliedCouponSubdoc {
  code: string;
  discountId: Types.ObjectId;
  amountFils: number;
}

const cartAppliedCouponSchema = new Schema<CartAppliedCouponSubdoc>(
  { code: { type: String, required: true }, discountId: { type: Schema.Types.ObjectId, required: true }, amountFils: { type: Number, required: true, min: 0 } },
  { _id: false },
);

export interface CartAutomaticDiscountSubdoc {
  discountId: Types.ObjectId;
  name: string;
  amountFils: number;
}

const cartAutomaticDiscountSchema = new Schema<CartAutomaticDiscountSubdoc>(
  { discountId: { type: Schema.Types.ObjectId, required: true }, name: { type: String, required: true }, amountFils: { type: Number, required: true, min: 0 } },
  { _id: false },
);

export interface CartTotalsSubdoc {
  subtotalFils: number;
  discountFils: number;
  shippingFils: number;
  codFeeFils: number;
  taxFils: number;
  grandTotalFils: number;
}

const cartTotalsSchema = new Schema<CartTotalsSubdoc>(
  {
    subtotalFils: { type: Number, required: true, default: 0 },
    discountFils: { type: Number, required: true, default: 0 },
    shippingFils: { type: Number, required: true, default: 0 },
    codFeeFils: { type: Number, required: true, default: 0 },
    taxFils: { type: Number, required: true, default: 0 },
    grandTotalFils: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

export type CartStatus = 'active' | 'converted' | 'abandoned' | 'merged';

export interface CartDoc {
  _id: Types.ObjectId;
  cartId: string;
  userId: Types.ObjectId | null;
  sessionId: string;
  items: Types.DocumentArray<CartItemDoc>;
  appliedCoupons: CartAppliedCouponSubdoc[];
  automaticDiscounts: CartAutomaticDiscountSubdoc[];
  totals: CartTotalsSubdoc;
  shippingAddressId: Types.ObjectId | null;
  shippingMethodId: Types.ObjectId | null;
  currency: 'AED';
  locale: 'en' | 'ar';
  status: CartStatus;
  abandonedEmailsSent: number;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const cartSchema = new Schema<CartDoc>(
  {
    cartId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sessionId: { type: String, required: true },
    items: { type: [cartItemSchema], default: [] },
    appliedCoupons: { type: [cartAppliedCouponSchema], default: [] },
    automaticDiscounts: { type: [cartAutomaticDiscountSchema], default: [] },
    totals: {
      type: cartTotalsSchema,
      default: () => ({ subtotalFils: 0, discountFils: 0, shippingFils: 0, codFeeFils: 0, taxFils: 0, grandTotalFils: 0 }),
    },
    shippingAddressId: { type: Schema.Types.ObjectId, ref: 'Address', default: null },
    shippingMethodId: { type: Schema.Types.ObjectId, default: null },
    currency: { type: String, enum: ['AED'], required: true, default: 'AED' },
    locale: { type: String, enum: ['en', 'ar'], required: true, default: 'en' },
    status: { type: String, enum: ['active', 'converted', 'abandoned', 'merged'], required: true, default: 'active' },
    abandonedEmailsSent: { type: Number, default: 0 },
    lastActivityAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'carts' },
);

// plan.md §7.14: { cartId:1 } unique, { userId:1 }, { expiresAt:1 } TTL,
// { status:1, lastActivityAt:1 } (abandoned-cart job — not built this phase).
cartSchema.index({ cartId: 1 }, { unique: true });
cartSchema.index({ userId: 1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
cartSchema.index({ status: 1, lastActivityAt: 1 });

export type CartHydratedDoc = HydratedDocument<CartDoc>;
export const CartModel = model<CartDoc>('Cart', cartSchema);
