import type {
  Discount,
  DiscountAppliesTo,
  DiscountBuyXGetY,
  DiscountMode,
  DiscountStatus,
  DiscountTier,
  DiscountType,
  Emirate,
  PaymentMethod,
} from '@lulwah/contracts';

/**
 * The Discounts builder's form-state shape — mirrors `apps/api`'s
 * `AdminCreateDiscountInput`/`AdminUpdateDiscountInput` field-for-field
 * (see `apps/api/src/modules/pricing/pricing.dto.ts`'s `BASE_FIELDS`), same
 * "redefined as a plain TS interface, not imported" reasoning as
 * `product-draft.ts` (that Zod object lives in `apps/api` and isn't
 * importable across the app boundary, plan.md §6's package rule).
 *
 * Two deliberate departures from `@lulwah/contracts`' `Discount` shape:
 * - `conditions.startsAt`/`endsAt` are `string | null` (a `datetime-local`
 *   input value) here, not `Date | null` — the exact same "form owns a
 *   string, server coerces it" pattern `product-draft.ts#publishAt` already
 *   established, reused rather than reinvented.
 * - `usage` omits `usedCount` — it's a server-owned counter (only
 *   `order`-confirmation increments it; see `discount.repository.ts`'s own
 *   doc comment), never something this form writes. Draft the update sends
 *   never includes it. The read-only current count is shown separately in
 *   the builder header, sourced straight from the loaded `Discount`.
 */
export interface DiscountDraftConditions {
  minSubtotalFils: number | null;
  minQuantity: number | null;
  firstOrderOnly: boolean;
  customerTags: string[] | null;
  emirates: Emirate[] | null;
  paymentMethods: PaymentMethod[] | null;
  startsAt: string | null;
  endsAt: string | null;
}

export interface DiscountDraftUsage {
  limitTotal: number | null;
  limitPerCustomer: number | null;
}

export interface DiscountDraft {
  name: string;
  internalDescription: string;
  mode: DiscountMode;
  code: string | null;
  type: DiscountType;
  value: number;
  tiers: DiscountTier[] | null;
  buyXGetY: DiscountBuyXGetY | null;

  appliesTo: DiscountAppliesTo;
  targetIds: string[];
  excludeIds: string[];

  conditions: DiscountDraftConditions;
  usage: DiscountDraftUsage;
  stackable: boolean;
  priority: number;
  status: DiscountStatus;
  showOnProductCard: boolean;
  bannerTextEn: string;
  bannerTextAr: string;
}

/** Matches `AdminCreateDiscountInput`'s own Zod `.default(...)` values
 *  exactly (`pricing.dto.ts`) — the new-discount route's starting point. */
export function emptyDiscountDraft(): DiscountDraft {
  return {
    name: '',
    internalDescription: '',
    mode: 'automatic',
    code: null,
    type: 'percentage',
    value: 0,
    tiers: null,
    buyXGetY: null,

    appliesTo: 'all',
    targetIds: [],
    excludeIds: [],

    conditions: {
      minSubtotalFils: null,
      minQuantity: null,
      firstOrderOnly: false,
      customerTags: null,
      emirates: null,
      paymentMethods: null,
      startsAt: null,
      endsAt: null,
    },
    usage: { limitTotal: null, limitPerCustomer: null },
    stackable: false,
    priority: 100,
    status: 'draft',
    showOnProductCard: false,
    bannerTextEn: '',
    bannerTextAr: '',
  };
}

/** `datetime-local` round-trip helper — identical technique to
 *  `product-draft.ts#productToDraft`'s `publishAt` handling. */
function toLocalInputValue(date: Date | string | null): string | null {
  if (!date) return null;
  return new Date(date).toISOString().slice(0, 16);
}

/** Maps a loaded `Discount` down to the editable subset the form owns
 *  (drops `id`/`usage.usedCount`/`createdAt`/`updatedAt`). */
export function discountToDraft(discount: Discount): DiscountDraft {
  return {
    name: discount.name,
    internalDescription: discount.internalDescription,
    mode: discount.mode,
    code: discount.code,
    type: discount.type,
    value: discount.value,
    tiers: discount.tiers,
    buyXGetY: discount.buyXGetY,

    appliesTo: discount.appliesTo,
    targetIds: discount.targetIds,
    excludeIds: discount.excludeIds,

    conditions: {
      minSubtotalFils: discount.conditions.minSubtotalFils,
      minQuantity: discount.conditions.minQuantity,
      firstOrderOnly: discount.conditions.firstOrderOnly,
      customerTags: discount.conditions.customerTags,
      emirates: discount.conditions.emirates,
      paymentMethods: discount.conditions.paymentMethods,
      startsAt: toLocalInputValue(discount.conditions.startsAt),
      endsAt: toLocalInputValue(discount.conditions.endsAt),
    },
    usage: { limitTotal: discount.usage.limitTotal, limitPerCustomer: discount.usage.limitPerCustomer },
    stackable: discount.stackable,
    priority: discount.priority,
    status: discount.status,
    showOnProductCard: discount.showOnProductCard,
    bannerTextEn: discount.bannerTextEn,
    bannerTextAr: discount.bannerTextAr,
  };
}

/** The exact body `POST`/`PATCH /admin/discounts*` expect — a straight
 *  passthrough (unlike `product-draft.ts#draftToBody`, no field here needs
 *  an empty-string-to-null rewrite; `startsAt`/`endsAt` being `''` never
 *  happens because the date inputs themselves emit `null`, not `''`, when
 *  cleared — see the Conditions tab). Also used to build each generated
 *  discount in bulk code generation, with only `code` swapped per call. */
export function draftToBody(draft: DiscountDraft): Record<string, unknown> {
  return { ...draft };
}
