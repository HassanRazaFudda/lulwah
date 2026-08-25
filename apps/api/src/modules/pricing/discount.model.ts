import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { DiscountAppliesTo, DiscountMode, DiscountStatus, DiscountType, Emirate, PaymentMethod } from '@lulwah/contracts';

/**
 * Mongoose schema for `discounts` — plan.md §7.12. Mirrors
 * `@lulwah/contracts`' `Discount` Zod schema field-for-field so
 * `discount.mapper.ts` is a straight copy. `pricing.repository.ts` is the
 * ONLY file allowed to touch this model (plan.md §5.4); `discount-
 * engine.ts` (the pure `applyDiscounts()`) never imports it at all — it
 * only knows the `@lulwah/contracts` `Discount` shape `pricing.service.ts`
 * hands it.
 */

export interface DiscountTierSubdoc {
  minSubtotalFils: number;
  value: number;
}

const discountTierSchema = new Schema<DiscountTierSubdoc>(
  { minSubtotalFils: { type: Number, required: true }, value: { type: Number, required: true } },
  { _id: false },
);

export interface DiscountBuyXGetYSubdoc {
  buyQty: number;
  getQty: number;
  appliesToCollectionId: Types.ObjectId | null;
  discountPercent: number;
}

const discountBuyXGetYSchema = new Schema<DiscountBuyXGetYSubdoc>(
  {
    buyQty: { type: Number, required: true },
    getQty: { type: Number, required: true },
    appliesToCollectionId: { type: Schema.Types.ObjectId, default: null },
    discountPercent: { type: Number, required: true },
  },
  { _id: false },
);

export interface DiscountConditionsSubdoc {
  minSubtotalFils: number | null;
  minQuantity: number | null;
  firstOrderOnly: boolean;
  customerTags: string[] | null;
  emirates: Emirate[] | null;
  paymentMethods: PaymentMethod[] | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

const discountConditionsSchema = new Schema<DiscountConditionsSubdoc>(
  {
    minSubtotalFils: { type: Number, default: null },
    minQuantity: { type: Number, default: null },
    firstOrderOnly: { type: Boolean, default: false },
    customerTags: { type: [String], default: null },
    emirates: { type: [String], default: null },
    paymentMethods: { type: [String], default: null },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { _id: false },
);

export interface DiscountUsageSubdoc {
  limitTotal: number | null;
  limitPerCustomer: number | null;
  usedCount: number;
}

const discountUsageSchema = new Schema<DiscountUsageSubdoc>(
  {
    limitTotal: { type: Number, default: null },
    limitPerCustomer: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
  },
  { _id: false },
);

export interface DiscountDoc {
  _id: Types.ObjectId;
  name: string;
  internalDescription: string;
  mode: DiscountMode;
  code: string | null;
  type: DiscountType;
  value: number;
  tiers: DiscountTierSubdoc[] | null;
  buyXGetY: DiscountBuyXGetYSubdoc | null;

  appliesTo: DiscountAppliesTo;
  targetIds: Types.ObjectId[];
  excludeIds: Types.ObjectId[];

  conditions: DiscountConditionsSubdoc;
  usage: DiscountUsageSubdoc;
  stackable: boolean;
  priority: number;
  status: DiscountStatus;
  showOnProductCard: boolean;
  bannerTextEn: string;
  bannerTextAr: string;

  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const discountSchema = new Schema<DiscountDoc>(
  {
    name: { type: String, required: true, trim: true },
    internalDescription: { type: String, default: '' },
    mode: { type: String, enum: ['automatic', 'code'], required: true },
    code: { type: String, uppercase: true, trim: true, default: null },
    type: { type: String, enum: ['percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y', 'tiered', 'bundle'], required: true },
    value: { type: Number, required: true, default: 0 },
    tiers: { type: [discountTierSchema], default: null },
    buyXGetY: { type: discountBuyXGetYSchema, default: null },

    appliesTo: { type: String, enum: ['all', 'products', 'collections', 'categories', 'brands'], required: true, default: 'all' },
    targetIds: { type: [Schema.Types.ObjectId], default: [] },
    excludeIds: { type: [Schema.Types.ObjectId], default: [] },

    conditions: { type: discountConditionsSchema, default: () => ({}) },
    usage: { type: discountUsageSchema, default: () => ({ limitTotal: null, limitPerCustomer: null, usedCount: 0 }) },
    stackable: { type: Boolean, default: false },
    priority: { type: Number, default: 100 },
    status: { type: String, enum: ['draft', 'active', 'scheduled', 'expired', 'disabled'], required: true, default: 'draft' },
    showOnProductCard: { type: Boolean, default: false },
    bannerTextEn: { type: String, default: '' },
    bannerTextAr: { type: String, default: '' },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'discounts' },
);

// plan.md §7.14: { code:1 } unique sparse, { mode:1, status:1, 'conditions.startsAt':1 }.
discountSchema.index({ code: 1 }, { unique: true, sparse: true });
discountSchema.index({ mode: 1, status: 1, 'conditions.startsAt': 1 });
discountSchema.index({ status: 1 });

export type DiscountHydratedDoc = HydratedDocument<DiscountDoc>;
export const DiscountModel = model<DiscountDoc>('Discount', discountSchema);
