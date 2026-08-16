import { formatMoney } from '@lulwah/utils';
import { cx } from '@lulwah/ui';

/**
 * PriceBlock — plan.md §8.2 "Price resolution order" / price-cut display
 * rule, reused on `ProductCard` and the PDP.
 *
 *   AED 249.00   ~~AED 349.00~~   -29%
 *
 * - Final price: ink, `Archivo` 600, tabular numerals (the `price` type
 *   token from `@lulwah/tokens`, or `heading-2` when `size="large"` on the
 *   PDP where the price needs to read as the dominant number on the page).
 * - Compare-at: struck through, Mukaish grey, one step smaller.
 * - `-N%` badge: Garnet, uppercase, tracked — rendered **only** when
 *   `discountPercent >= 5` (plan.md §8.2: "Rendered only if discountPercent
 *   >= 5 and discount.showOnProductCard" — the `showOnProductCard` half of
 *   that rule lives on the real Discount entity from the pricing/discount
 *   engine, which isn't wired into this storefront skeleton; only the
 *   numeric threshold is enforced here).
 * - Never fabricates a compare-at: if `compareAtPriceFils` isn't strictly
 *   greater than `priceFils`, no strike-through and no badge render at
 *   all, regardless of the stored value.
 */

/**
 * `discountPercent = round((compareAt - final) / compareAt * 100)` per
 * plan.md §8.2 step 4. Exported standalone (not just used inline) so it is
 * unit-testable in isolation from rendering — see `__tests__/PriceBlock.test.tsx`.
 * Returns `0` when there is no genuine price cut (no compare-at, or
 * compare-at at or below the selling price) rather than a negative number.
 */
export function computeDiscountPercent(compareAtPriceFils: number | null | undefined, priceFils: number): number {
  if (compareAtPriceFils == null || compareAtPriceFils <= priceFils) {
    return 0;
  }
  return Math.round(((compareAtPriceFils - priceFils) / compareAtPriceFils) * 100);
}

/** The badge only ever appears above this threshold — plan.md §8.2. */
export const DISCOUNT_BADGE_MIN_PERCENT = 5;

export interface PriceBlockProps {
  priceFils: number;
  // `| undefined` explicit (not just an optional `?`) because callers
  // routinely forward an already-optional `compareAtPriceFils` prop
  // straight through — under `exactOptionalPropertyTypes`, a value whose
  // static type is `T | undefined` can't target a `?: T` key otherwise.
  compareAtPriceFils?: number | null | undefined;
  locale: 'en' | 'ar';
  /** `large` is the PDP treatment — the final price is set in `heading-2` rather than the smaller `price` type-scale step used on cards. */
  size?: 'default' | 'large';
  className?: string;
}

export function PriceBlock({ priceFils, compareAtPriceFils, locale, size = 'default', className }: PriceBlockProps) {
  const hasPriceCut = compareAtPriceFils != null && compareAtPriceFils > priceFils;
  const discountPercent = computeDiscountPercent(compareAtPriceFils, priceFils);
  const showBadge = hasPriceCut && discountPercent >= DISCOUNT_BADGE_MIN_PERCENT;

  return (
    <div className={cx('flex flex-wrap items-baseline gap-8', className)} data-testid="price-block">
      <span
        className={cx(
          'font-body font-semibold tabular-nums text-ink',
          size === 'large' ? 'text-heading-2' : 'text-price',
        )}
      >
        {formatMoney(priceFils, locale)}
      </span>
      {hasPriceCut ? (
        <span className="font-body text-body-sm tabular-nums text-mukaish line-through decoration-1">
          {formatMoney(compareAtPriceFils, locale)}
        </span>
      ) : null}
      {showBadge ? (
        <span className="font-body text-label font-semibold tracking-label text-garnet uppercase">
          -{discountPercent}%
        </span>
      ) : null}
    </div>
  );
}
