import { z } from 'zod';
import { Discount, DiscountAppliesTo, DiscountMode, DiscountStatus, DiscountType, Emirate, Fils, PaymentMethod, objectId } from '@lulwah/contracts';

/**
 * Request/response DTOs for `/admin/discounts` — plan.md §9.7. `Discount`
 * itself lives in `@lulwah/contracts` (reused, not redefined).
 *
 * **Why create/update are built from `BASE_FIELDS` with no `.default()`
 * on it, rather than `AdminCreateDiscountInput.partial()`:** Zod's
 * `.partial()` wraps each field in `.optional()`, but a field that
 * already carries its own `.default(...)` (from the create schema) still
 * *fires that default* when the key is entirely absent from a PATCH body
 * — `.optional()` stacked on top of `.default()` doesn't suppress it.
 * Concretely: `AdminCreateDiscountInput.partial().parse({ value: 20 })`
 * came back with `status: 'draft'` even though `status` was never in the
 * input, because `status` carries `.default('draft')` — a `PATCH
 * /admin/discounts/:id { value: 20 }` would have silently reset an
 * `active` discount to `draft`. Found via `pricing.integration.test.ts`.
 * `AdminUpdateDiscountInput` is built from the same field definitions
 * *without* any `.default(...)` at all, so an omitted key genuinely stays
 * omitted (`pricing.service.ts#updateDiscount` only ever forwards keys
 * that were actually present).
 */

const DiscountTierInput = z.object({ minSubtotalFils: Fils, value: z.number() });
const DiscountBuyXGetYInput = z.object({
  buyQty: z.number().int().positive(),
  getQty: z.number().int().positive(),
  appliesToCollectionId: objectId.nullable(),
  discountPercent: z.number().min(0).max(100),
});
const DiscountConditionsInput = z.object({
  minSubtotalFils: Fils.nullable(),
  minQuantity: z.number().int().positive().nullable(),
  firstOrderOnly: z.boolean(),
  customerTags: z.array(z.string()).nullable(),
  emirates: z.array(Emirate).nullable(),
  paymentMethods: z.array(PaymentMethod).nullable(),
  startsAt: z.coerce.date().nullable(),
  endsAt: z.coerce.date().nullable(),
});
const DiscountUsageInput = z.object({
  limitTotal: z.number().int().positive().nullable(),
  limitPerCustomer: z.number().int().positive().nullable(),
});

const DEFAULT_CONDITIONS = {
  minSubtotalFils: null,
  minQuantity: null,
  firstOrderOnly: false,
  customerTags: null,
  emirates: null,
  paymentMethods: null,
  startsAt: null,
  endsAt: null,
} as const;
const DEFAULT_USAGE = { limitTotal: null, limitPerCustomer: null } as const;

/** No `.default()` anywhere in here — see this file's doc comment. Both
 *  `AdminCreateDiscountInput` and `AdminUpdateDiscountInput` are built
 *  from this one definition so the two schemas can never drift apart on
 *  what a field even *is*, only on whether it's required/defaulted. */
const BASE_FIELDS = {
  name: z.string().min(1),
  internalDescription: z.string(),
  code: z.string().min(1).nullable(),
  type: DiscountType,
  value: z.number(),
  tiers: z.array(DiscountTierInput).nullable(),
  buyXGetY: DiscountBuyXGetYInput.nullable(),
  appliesTo: DiscountAppliesTo,
  targetIds: z.array(objectId),
  excludeIds: z.array(objectId),
  conditions: DiscountConditionsInput,
  usage: DiscountUsageInput,
  stackable: z.boolean(),
  priority: z.number().int(),
  status: DiscountStatus,
  showOnProductCard: z.boolean(),
  bannerTextEn: z.string(),
  bannerTextAr: z.string(),
};

export const AdminCreateDiscountInput = z.object({
  ...BASE_FIELDS,
  mode: DiscountMode,
  internalDescription: BASE_FIELDS.internalDescription.default(''),
  code: BASE_FIELDS.code.default(null),
  value: BASE_FIELDS.value.default(0),
  tiers: BASE_FIELDS.tiers.default(null),
  buyXGetY: BASE_FIELDS.buyXGetY.default(null),
  appliesTo: BASE_FIELDS.appliesTo.default('all'),
  targetIds: BASE_FIELDS.targetIds.default([]),
  excludeIds: BASE_FIELDS.excludeIds.default([]),
  conditions: BASE_FIELDS.conditions.default(() => ({ ...DEFAULT_CONDITIONS })),
  usage: BASE_FIELDS.usage.default(() => ({ ...DEFAULT_USAGE })),
  stackable: BASE_FIELDS.stackable.default(false),
  priority: BASE_FIELDS.priority.default(100),
  status: BASE_FIELDS.status.default('draft'),
  showOnProductCard: BASE_FIELDS.showOnProductCard.default(false),
  bannerTextEn: BASE_FIELDS.bannerTextEn.default(''),
  bannerTextAr: BASE_FIELDS.bannerTextAr.default(''),
});
export type AdminCreateDiscountInput = z.infer<typeof AdminCreateDiscountInput>;

/** Every field genuinely optional, none defaulted — an omitted key stays
 *  omitted all the way to `discount.repository.ts#updateDiscount`, which
 *  only ever `$set`s what was actually provided. */
export const AdminUpdateDiscountInput = z.object(BASE_FIELDS).partial();
export type AdminUpdateDiscountInput = z.infer<typeof AdminUpdateDiscountInput>;

export const AdminListDiscountsQuery = z.object({
  status: DiscountStatus.optional(),
  mode: DiscountMode.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type AdminListDiscountsQuery = z.infer<typeof AdminListDiscountsQuery>;

export const DiscountResponse = z.object({ discount: Discount });
export type DiscountResponse = z.infer<typeof DiscountResponse>;

export const DiscountListResponse = z.object({ discounts: z.array(Discount) });
export type DiscountListResponse = z.infer<typeof DiscountListResponse>;
