import { z } from 'zod';
import { objectId } from './common.js';
import { DiscountType, Emirate, PaymentMethod } from './enums.js';
import { Fils } from './money.js';

/**
 * Discount — plan.md §7.12. The engine that consumes this shape,
 * `applyDiscounts()` (plan.md §8.3), lives in
 * `apps/api/src/modules/pricing/discount-engine.ts` as a pure,
 * framework-free function; this file only defines the wire/storage shape.
 */

export const DiscountMode = z.enum(['automatic', 'code']);
export type DiscountMode = z.infer<typeof DiscountMode>;

export const DiscountAppliesTo = z.enum(['all', 'products', 'collections', 'categories', 'brands']);
export type DiscountAppliesTo = z.infer<typeof DiscountAppliesTo>;

export const DiscountStatus = z.enum(['draft', 'active', 'scheduled', 'expired', 'disabled']);
export type DiscountStatus = z.infer<typeof DiscountStatus>;

export const DiscountTier = z.object({
  minSubtotalFils: Fils,
  value: z.number(),
});
export type DiscountTier = z.infer<typeof DiscountTier>;

export const DiscountBuyXGetY = z.object({
  buyQty: z.number().int().positive(),
  getQty: z.number().int().positive(),
  appliesToCollectionId: objectId.nullable(),
  discountPercent: z.number().min(0).max(100),
});
export type DiscountBuyXGetY = z.infer<typeof DiscountBuyXGetY>;

export const DiscountConditions = z.object({
  minSubtotalFils: Fils.nullable(),
  minQuantity: z.number().int().positive().nullable(),
  firstOrderOnly: z.boolean(),
  customerTags: z.array(z.string()).nullable(),
  emirates: z.array(Emirate).nullable(),
  paymentMethods: z.array(PaymentMethod).nullable(),
  startsAt: z.coerce.date().nullable(),
  endsAt: z.coerce.date().nullable(),
});
export type DiscountConditions = z.infer<typeof DiscountConditions>;

export const DiscountUsage = z.object({
  limitTotal: z.number().int().positive().nullable(),
  limitPerCustomer: z.number().int().positive().nullable(),
  usedCount: z.number().int().nonnegative(),
});
export type DiscountUsage = z.infer<typeof DiscountUsage>;

export const Discount = z.object({
  id: objectId,
  name: z.string(),
  internalDescription: z.string(),
  mode: DiscountMode,
  code: z.string().nullable(), // uppercase, unique sparse — only set when mode === 'code'
  type: DiscountType,
  value: z.number(), // 20 = 20% | fils for fixed_amount
  tiers: z.array(DiscountTier).nullable(),
  buyXGetY: DiscountBuyXGetY.nullable(),

  appliesTo: DiscountAppliesTo,
  targetIds: z.array(objectId),
  excludeIds: z.array(objectId),

  conditions: DiscountConditions,
  usage: DiscountUsage,
  stackable: z.boolean(),
  priority: z.number().int(), // lower runs first
  status: DiscountStatus,
  showOnProductCard: z.boolean(),
  bannerTextEn: z.string(),
  bannerTextAr: z.string(),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Discount = z.infer<typeof Discount>;
