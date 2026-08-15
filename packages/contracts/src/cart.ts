import { z } from 'zod';
import { objectId } from './common.js';
import { Fils } from './money.js';

/** Cart / CartItem — plan.md §7.10. Redis mirrors the active cart for
 *  sub-10ms reads; Mongo is the durable record. */

export const CartItemStitching = z.object({
  enabled: z.boolean(),
  measurementProfileId: objectId.nullable(),
  priceFils: Fils,
  leadDays: z.number().int().nonnegative(),
});
export type CartItemStitching = z.infer<typeof CartItemStitching>;

export const CartItem = z.object({
  id: objectId,
  productId: objectId,
  variantId: objectId,
  quantity: z.number().int().positive().max(10), // max qty per line — §8.5
  unitPriceFils: Fils, // snapshot at add time
  compareAtPriceFils: Fils.nullable(),
  stitching: CartItemStitching.nullable(),
  giftWrap: z.boolean(),
  addedAt: z.coerce.date(),
  priceLockedUntil: z.coerce.date(),
});
export type CartItem = z.infer<typeof CartItem>;

export const CartAppliedCoupon = z.object({
  code: z.string(),
  discountId: objectId,
  amountFils: Fils,
});
export type CartAppliedCoupon = z.infer<typeof CartAppliedCoupon>;

export const CartAutomaticDiscount = z.object({
  discountId: objectId,
  name: z.string(),
  amountFils: Fils,
});
export type CartAutomaticDiscount = z.infer<typeof CartAutomaticDiscount>;

export const CartTotals = z.object({
  subtotalFils: Fils,
  discountFils: Fils,
  shippingFils: Fils,
  codFeeFils: Fils,
  taxFils: Fils,
  grandTotalFils: Fils,
});
export type CartTotals = z.infer<typeof CartTotals>;

export const CartStatus = z.enum(['active', 'converted', 'abandoned', 'merged']);
export type CartStatus = z.infer<typeof CartStatus>;

export const Cart = z.object({
  cartId: z.string(), // uuid, carried in a cookie
  userId: objectId.nullable(),
  sessionId: z.string(),
  items: z.array(CartItem).max(50), // max distinct lines — §8.5
  appliedCoupons: z.array(CartAppliedCoupon).max(1), // only one coupon code per order — §8.3
  automaticDiscounts: z.array(CartAutomaticDiscount),
  totals: CartTotals,
  shippingAddressId: objectId.nullable(),
  shippingMethodId: objectId.nullable(),
  currency: z.literal('AED'),
  locale: z.enum(['en', 'ar']),
  status: CartStatus,
  abandonedEmailsSent: z.number().int().nonnegative(),
  lastActivityAt: z.coerce.date(),
  expiresAt: z.coerce.date(), // TTL index, 30 days
});
export type Cart = z.infer<typeof Cart>;
