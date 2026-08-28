import type { DiscountDraft } from './discount-draft';

export interface DiscountPreviewResult {
  /** `false` means this configuration is outside what this estimate can
   *  honestly compute — `discountFils` is always `0` in that case and
   *  `message` explains why, rather than showing a number that would look
   *  authoritative but isn't. */
  supported: boolean;
  discountFils: number;
  message: string;
}

/**
 * A deliberately approximate, CLIENT-SIDE-ONLY estimate of plan.md §11.1's
 * "on a sample cart of X, this discount gives AED Y off" live preview.
 *
 * This is NOT the real discount engine. `applyDiscounts()`
 * (`apps/api/src/modules/pricing/discount-engine.ts`) is a server-only,
 * framework-free function that isn't exposed over HTTP for a client to call
 * (confirmed by reading `pricing.routes.ts` — there is no preview/simulate
 * endpoint) or reusable as a package (it lives in `apps/api`, not
 * `@lulwah/contracts` or another shared package). Building a live preview
 * therefore means either skipping it or re-deriving a best-effort subset of
 * the same maths client-side — this file takes the second option, but only
 * for the cases simple enough to reproduce faithfully:
 *
 * - `type: 'percentage' | 'fixed_amount'` only — `tiered`/`buy_x_get_y`/
 *   `bundle`/`free_shipping` all have real branch logic in
 *   `discount-engine.ts#computeDiscountAmount` this file does not
 *   reimplement (see that function for what each actually does).
 * - `appliesTo: 'all'` only, with no `excludeIds` — anything targeted
 *   depends on which real products/collections/categories/brands are in a
 *   real cart, which this estimate has no way to know without duplicating
 *   the engine's whole eligibility/allocation pipeline.
 * - `conditions.minQuantity` unset — same reason (no real line items to
 *   count).
 * - Never accounts for `stackable`/`priority` interaction with any OTHER
 *   discount, or the order-level proration/cap steps
 *   (`discount-engine.ts`'s `proRataAllocate` and step-6 cap) — this
 *   estimate only ever evaluates ONE discount against ONE flat sample
 *   subtotal, in isolation.
 *
 * Everything it DOES compute mirrors the real engine's own rounding rule
 * exactly (`Math.round`, capped at the eligible base) so that for the cases
 * it covers, the number is not just plausible but actually correct.
 */
export function estimateDiscountPreview(draft: DiscountDraft, sampleSubtotalFils: number): DiscountPreviewResult {
  if (draft.appliesTo !== 'all') {
    return {
      supported: false,
      discountFils: 0,
      message:
        'Preview is only available for discounts that apply to the whole catalogue ("Applies to: All products") — a targeted discount depends on which real products/collections/categories/brands are actually in the cart, which this estimate cannot know.',
    };
  }
  if (draft.excludeIds.length > 0) {
    return {
      supported: false,
      discountFils: 0,
      message: 'Preview is not available while exclusions are set — same reason as targeting above.',
    };
  }
  if (draft.type !== 'percentage' && draft.type !== 'fixed_amount') {
    return {
      supported: false,
      discountFils: 0,
      message: `Preview is not available for "${draft.type.replace(/_/g, ' ')}" discounts — this estimate only reproduces simple percentage/fixed-amount math, not the real engine's tiered, buy-X-get-Y, or bundle logic.`,
    };
  }
  if (draft.conditions.minQuantity !== null) {
    return {
      supported: false,
      discountFils: 0,
      message: 'Preview is not available while a minimum-quantity condition is set — this estimate has no sample cart line items to count against it.',
    };
  }
  if (sampleSubtotalFils <= 0) {
    return { supported: true, discountFils: 0, message: 'Enter a sample cart subtotal above AED 0.00 to see an estimate.' };
  }
  if (draft.conditions.minSubtotalFils !== null && sampleSubtotalFils < draft.conditions.minSubtotalFils) {
    return {
      supported: true,
      discountFils: 0,
      message: `This sample cart doesn't meet the AED ${(draft.conditions.minSubtotalFils / 100).toFixed(2)} minimum spend condition, so it gets AED 0.00 off.`,
    };
  }

  const raw = draft.type === 'percentage' ? Math.round(sampleSubtotalFils * (draft.value / 100)) : Math.round(draft.value);
  const discountFils = Math.max(0, Math.min(sampleSubtotalFils, raw));

  return {
    supported: true,
    discountFils,
    message: `On a sample cart of AED ${(sampleSubtotalFils / 100).toFixed(2)}, this discount gives AED ${(discountFils / 100).toFixed(2)} off.`,
  };
}
