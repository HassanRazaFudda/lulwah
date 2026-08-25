import { formatMoney } from '@lulwah/utils';
import type { Discount } from '@lulwah/contracts';

/**
 * `applyDiscounts()` — plan.md §8.3. "A single pure function — the only
 * place discount maths exists." Framework-free: no Mongoose, no Express,
 * no I/O. `pricing.service.ts` is the impure wrapper that loads candidate
 * `Discount` rows from Mongo (and, for usage limits, would consult Redis
 * for a fast pre-check — see that file's doc comment on why this phase
 * skips that optimization) and hands them to this function already
 * resolved.
 *
 * **What the caller must pass in `discounts`:** every currently-`active`
 * automatic discount within its date window, PLUS — regardless of its own
 * status/window — the specific `Discount` row matching each code in
 * `cart.couponCodes`, if one exists. Including an inactive/expired/out-of-
 * window coupon-code match is what lets this function return a *specific*
 * rejection reason ("this code has expired") instead of a blanket "invalid
 * code" for a code that resolves to a real (but currently unusable)
 * discount, while a code matching nothing at all becomes `COUPON_INVALID`.
 */

export interface CartLineSnapshot {
  itemId: string;
  productId: string;
  variantId: string;
  categoryIds: string[];
  brandId: string;
  collectionIds: string[];
  quantity: number;
  unitPriceFils: number;
  lineTotalFils: number; // unitPriceFils * quantity
}

export interface CartSnapshot {
  lines: CartLineSnapshot[];
  subtotalFils: number;
  /** plan.md §8.3: "Only one coupon code per order" — at most one entry by
   *  construction (`cart.service.ts` replaces, never appends), but this
   *  function only ever looks at the first if more slip through. */
  couponCodes: string[];
}

export interface DiscountEligibilityContext {
  now: Date;
  isFirstOrder: boolean;
  customerTags: readonly string[];
  /** Unresolved at cart phase (chosen at checkout) — `null` means "not yet
   *  known." A condition gated on one of these is treated as *provisionally
   *  satisfied* when the context can't yet answer it, and is re-verified
   *  strictly once checkout provides a real value and again at order
   *  creation (plan.md §8.3: "recalculation happens ... again at order
   *  creation" is the authoritative gate this defers to). Documented
   *  interpretation — the plan doesn't spell out cart-phase-vs-checkout-
   *  phase behavior for these two conditions explicitly. */
  paymentMethod: string | null;
  emirate: string | null;
  /** The shipping fee a `free_shipping` discount would zero out. `0` at
   *  cart phase (shipping is resolved at checkout, plan.md §9.5) — this
   *  function still records that a free-shipping discount is eligible
   *  (`applied`), it just has nothing to discount yet. */
  currentShippingFils: number;
  /** Per-discount current redemption count for THIS customer, keyed by
   *  discount id — `{}` (unknown/0) until the `order` module exists to
   *  report real redemption history (see `pricing.service.ts`'s doc
   *  comment). `limitPerCustomer` is still checked against whatever this
   *  provides, so the engine itself is spec-complete and testable with any
   *  input, even though nothing populates real counts yet. */
  perCustomerUsage: Readonly<Record<string, number>>;
}

export interface AppliedDiscount {
  discountId: string;
  code: string | null;
  name: string;
  type: Discount['type'];
  /** Order-level (line-allocatable) portion. */
  amountFils: number;
  /** The `free_shipping` lane's own contribution — always 0 for every
   *  other type. */
  shippingAmountFils: number;
}

export type RejectedDiscountCode =
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'COUPON_USAGE_LIMIT'
  | 'COUPON_NOT_ELIGIBLE'
  | 'COUPON_MIN_SUBTOTAL';

export interface RejectedDiscount {
  code: string | null;
  discountId: string | null;
  errorCode: RejectedDiscountCode;
  /** A specific, human reason (plan.md §8.3: "'This code applies to Lawn
   *  '26 only', not 'Invalid code'"). */
  reason: string;
}

export interface ApplyDiscountsResult {
  /** Σ over every entry === `orderDiscountFils`, exactly — plan.md §8.3's
   *  own required invariant (needed for correct partial refunds/VAT). */
  lineDiscounts: Map<string, number>;
  orderDiscountFils: number;
  shippingDiscountFils: number;
  applied: AppliedDiscount[];
  rejected: RejectedDiscount[];
}

function matchesTarget(d: Discount, line: CartLineSnapshot): boolean {
  switch (d.appliesTo) {
    case 'all':
      return true;
    case 'products':
      return d.targetIds.includes(line.productId);
    case 'brands':
      return d.targetIds.includes(line.brandId);
    case 'categories':
      return line.categoryIds.some((id) => d.targetIds.includes(id));
    case 'collections':
      return line.collectionIds.some((id) => d.targetIds.includes(id));
  }
}

function isExcluded(d: Discount, line: CartLineSnapshot): boolean {
  if (d.excludeIds.length === 0) return false;
  return (
    d.excludeIds.includes(line.productId) ||
    d.excludeIds.includes(line.brandId) ||
    line.categoryIds.some((id) => d.excludeIds.includes(id)) ||
    line.collectionIds.some((id) => d.excludeIds.includes(id))
  );
}

function eligibleLinesFor(d: Discount, lines: readonly CartLineSnapshot[]): CartLineSnapshot[] {
  return lines.filter((line) => matchesTarget(d, line) && !isExcluded(d, line));
}

/**
 * Distributes `amountFils` across `lines` proportionally by
 * `lineTotalFils`, remainder to the largest line — plan.md §8.3 step 5.
 * Floor-then-remainder guarantees the returned map's values sum to exactly
 * `amountFils` (never more, by construction; the remainder step brings it
 * up to exactly, never past, since `amountFils - allocated` after flooring
 * every share is always `>= 0` and `< lines.length`... in fils terms,
 * `< lines.length`, comfortably absorbed by one line).
 */
export function proRataAllocate(amountFils: number, lines: readonly { itemId: string; baseFils: number }[]): Map<string, number> {
  const result = new Map<string, number>();
  if (amountFils <= 0 || lines.length === 0) return result;
  const totalBase = lines.reduce((sum, l) => sum + l.baseFils, 0);
  if (totalBase <= 0) return result;

  let allocated = 0;
  let largest = lines[0] as { itemId: string; baseFils: number };
  for (const line of lines) {
    const share = Math.floor((amountFils * line.baseFils) / totalBase);
    result.set(line.itemId, share);
    allocated += share;
    if (line.baseFils > largest.baseFils) largest = line;
  }

  const remainder = amountFils - allocated;
  if (remainder > 0) {
    result.set(largest.itemId, (result.get(largest.itemId) ?? 0) + remainder);
  }
  return result;
}

function isWithinWindow(d: Discount, now: Date): boolean {
  if (d.conditions.startsAt && now < d.conditions.startsAt) return false;
  if (d.conditions.endsAt && now > d.conditions.endsAt) return false;
  return true;
}

/** Every non-targeting eligibility condition — status/window/subtotal/
 *  quantity/first-order/tags/emirate/payment-method/usage. Returns the
 *  specific rejection this discount currently fails on, or `null` if none. */
function ineligibilityReason(
  d: Discount,
  cart: CartSnapshot,
  ctx: DiscountEligibilityContext,
  matchedLines: readonly CartLineSnapshot[],
): { code: RejectedDiscountCode; reason: string } | null {
  if (d.status === 'expired' || (d.conditions.endsAt && ctx.now > d.conditions.endsAt)) {
    return { code: 'COUPON_EXPIRED', reason: 'This code has expired.' };
  }
  if (d.status !== 'active') {
    return { code: 'COUPON_INVALID', reason: 'This code is not currently active.' };
  }
  if (!isWithinWindow(d, ctx.now)) {
    return { code: 'COUPON_EXPIRED', reason: 'This code is not active yet.' };
  }
  if (matchedLines.length === 0) {
    return { code: 'COUPON_NOT_ELIGIBLE', reason: `${d.name} does not apply to any item in your cart.` };
  }
  if (d.conditions.minSubtotalFils !== null && cart.subtotalFils < d.conditions.minSubtotalFils) {
    return { code: 'COUPON_MIN_SUBTOTAL', reason: `Spend at least ${formatMoney(d.conditions.minSubtotalFils, 'en')} to use this code.` };
  }
  if (d.conditions.minQuantity !== null) {
    const matchedQty = matchedLines.reduce((sum, l) => sum + l.quantity, 0);
    if (matchedQty < d.conditions.minQuantity) {
      return { code: 'COUPON_NOT_ELIGIBLE', reason: `Add at least ${d.conditions.minQuantity} eligible items to use this code.` };
    }
  }
  if (d.conditions.firstOrderOnly && !ctx.isFirstOrder) {
    return { code: 'COUPON_NOT_ELIGIBLE', reason: 'This code is for first-time customers only.' };
  }
  if (d.conditions.customerTags && d.conditions.customerTags.length > 0) {
    const hasTag = d.conditions.customerTags.some((tag) => ctx.customerTags.includes(tag));
    if (!hasTag) return { code: 'COUPON_NOT_ELIGIBLE', reason: 'This code is not available on your account.' };
  }
  if (d.conditions.emirates && d.conditions.emirates.length > 0 && ctx.emirate !== null && !d.conditions.emirates.includes(ctx.emirate as never)) {
    return { code: 'COUPON_NOT_ELIGIBLE', reason: 'This code is not available for delivery to your emirate.' };
  }
  if (d.conditions.paymentMethods && d.conditions.paymentMethods.length > 0 && ctx.paymentMethod !== null && !d.conditions.paymentMethods.includes(ctx.paymentMethod as never)) {
    return { code: 'COUPON_NOT_ELIGIBLE', reason: 'This code is only available with certain payment methods.' };
  }
  if (d.usage.limitTotal !== null && d.usage.usedCount >= d.usage.limitTotal) {
    return { code: 'COUPON_USAGE_LIMIT', reason: 'This code has reached its usage limit.' };
  }
  if (d.usage.limitPerCustomer !== null && (ctx.perCustomerUsage[d.id] ?? 0) >= d.usage.limitPerCustomer) {
    return { code: 'COUPON_USAGE_LIMIT', reason: "You've already used this code the maximum number of times." };
  }
  return null;
}

/** The fils amount `d` would take off `eligibleBase` (the still-remaining
 *  value of the lines it targets, after any earlier-applied discount in
 *  the same run already reduced them) — plan.md §8.2's `type` vocabulary.
 *  `tiered`/`buy_x_get_y`/`bundle` aren't fully specified beyond their
 *  field shapes (plan.md §7.12) — the interpretations below are this
 *  engine's own documented, defensible reading, not a literal plan.md
 *  transcription. */
function computeDiscountAmount(d: Discount, eligibleBase: number, matchedLines: readonly CartLineSnapshot[]): number {
  if (eligibleBase <= 0) return 0;
  switch (d.type) {
    case 'percentage':
      return Math.min(eligibleBase, Math.round(eligibleBase * (d.value / 100)));
    case 'fixed_amount':
      return Math.min(eligibleBase, Math.max(0, Math.round(d.value)));
    case 'tiered': {
      const tiers = d.tiers ?? [];
      const tier = tiers
        .filter((t) => eligibleBase >= t.minSubtotalFils)
        .sort((a, b) => b.minSubtotalFils - a.minSubtotalFils)[0];
      if (!tier) return 0;
      return Math.min(eligibleBase, Math.round(eligibleBase * (tier.value / 100)));
    }
    case 'buy_x_get_y': {
      const bxgy = d.buyXGetY;
      if (!bxgy) return 0;
      const scopedLines = bxgy.appliesToCollectionId ? matchedLines.filter((l) => l.collectionIds.includes(bxgy.appliesToCollectionId as string)) : matchedLines;
      const totalQty = scopedLines.reduce((sum, l) => sum + l.quantity, 0);
      const scopedBase = scopedLines.reduce((sum, l) => sum + l.lineTotalFils, 0);
      if (totalQty === 0 || scopedBase === 0) return 0;
      const avgUnitFils = scopedBase / totalQty;
      const groupSize = bxgy.buyQty + bxgy.getQty;
      const applications = Math.floor(totalQty / groupSize);
      const discountedUnits = applications * bxgy.getQty;
      return Math.min(eligibleBase, Math.round(discountedUnits * avgUnitFils * (bxgy.discountPercent / 100)));
    }
    case 'bundle':
      // No bundle-specific fields exist in plan.md §7.12 beyond the shared
      // ones — treated as a flat fils amount off the eligible base, same
      // as `fixed_amount`.
      return Math.min(eligibleBase, Math.max(0, Math.round(d.value)));
    case 'free_shipping':
      return 0; // handled entirely in the shipping lane, never the order lane
  }
}

function byPriorityThenValueDesc(a: Discount, b: Discount): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  return b.value - a.value;
}

export function applyDiscounts(cart: CartSnapshot, discounts: readonly Discount[], ctx: DiscountEligibilityContext): ApplyDiscountsResult {
  const rejected: RejectedDiscount[] = [];
  const requestedCode = cart.couponCodes[0]?.toUpperCase();

  // --- eligibility filter (plan.md §8.3 step 2) -----------------------------
  const candidates = discounts.filter((d) => {
    const matchedLines = eligibleLinesFor(d, cart.lines);
    const failure = ineligibilityReason(d, cart, ctx, matchedLines);
    if (!failure) return true;
    // Automatic discounts that fail eligibility are just skipped — nothing
    // was explicitly requested, so there's nothing to report a rejection
    // for. Only the shopper's own coupon code generates a `rejected` entry.
    if (d.mode === 'code' && d.code?.toUpperCase() === requestedCode) {
      rejected.push({ code: d.code, discountId: d.id, errorCode: failure.code, reason: failure.reason });
    }
    return false;
  });

  if (requestedCode && !discounts.some((d) => d.mode === 'code' && d.code?.toUpperCase() === requestedCode)) {
    rejected.push({ code: requestedCode, discountId: null, errorCode: 'COUPON_INVALID', reason: 'This code does not exist.' });
  }

  // --- sort (step 3) ---------------------------------------------------------
  const sorted = [...candidates].sort(byPriorityThenValueDesc);
  const freeShippingLane = sorted.filter((d) => d.type === 'free_shipping');
  const orderLane = sorted.filter((d) => d.type !== 'free_shipping');

  // --- apply sequentially, with pro-rata line allocation (steps 4-5) --------
  const remainingByItem = new Map(cart.lines.map((l) => [l.itemId, l.lineTotalFils]));
  const lineDiscounts = new Map<string, number>();
  const applied: AppliedDiscount[] = [];
  let orderDiscountFils = 0;

  for (const d of orderLane) {
    const matchedLines = eligibleLinesFor(d, cart.lines);
    const eligibleBase = matchedLines.reduce((sum, l) => sum + (remainingByItem.get(l.itemId) ?? 0), 0);
    const amount = computeDiscountAmount(d, eligibleBase, matchedLines);
    if (amount <= 0) continue;

    const allocation = proRataAllocate(
      amount,
      matchedLines.map((l) => ({ itemId: l.itemId, baseFils: remainingByItem.get(l.itemId) ?? 0 })),
    );
    for (const [itemId, share] of allocation) {
      lineDiscounts.set(itemId, (lineDiscounts.get(itemId) ?? 0) + share);
      remainingByItem.set(itemId, Math.max(0, (remainingByItem.get(itemId) ?? 0) - share));
    }

    orderDiscountFils += amount;
    applied.push({ discountId: d.id, code: d.mode === 'code' ? d.code : null, name: d.name, type: d.type, amountFils: amount, shippingAmountFils: 0 });

    // plan.md §8.3: "If a discount is stackable: false, it terminates
    // further order-level discounts" — full stop, including discounts
    // after it that are themselves stackable.
    if (!d.stackable) break;
  }

  // --- free-shipping lane: separate, always stacks (step 4) -----------------
  let shippingDiscountFils = 0;
  const firstFreeShipping = freeShippingLane[0];
  if (firstFreeShipping) {
    shippingDiscountFils = ctx.currentShippingFils;
    applied.push({ discountId: firstFreeShipping.id, code: firstFreeShipping.mode === 'code' ? firstFreeShipping.code : null, name: firstFreeShipping.name, type: 'free_shipping', amountFils: 0, shippingAmountFils: shippingDiscountFils });
  }

  // --- cap (step 6): total discount can never exceed subtotal ---------------
  if (orderDiscountFils > cart.subtotalFils) {
    // Scale every line's allocation down proportionally so the Σ === subtotal
    // invariant still holds exactly after capping.
    const capped = proRataAllocate(
      cart.subtotalFils,
      [...lineDiscounts.entries()].map(([itemId, amt]) => ({ itemId, baseFils: amt })),
    );
    lineDiscounts.clear();
    for (const [itemId, amt] of capped) lineDiscounts.set(itemId, amt);
    orderDiscountFils = cart.subtotalFils;
  }

  return { lineDiscounts, orderDiscountFils, shippingDiscountFils, applied, rejected };
}
