'use client';

import { useState } from 'react';
import { formatMoney } from '@lulwah/utils';
import { Button } from '@lulwah/ui';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { QuantityStepper } from '@/components/commerce/QuantityStepper';
import { useApplyCoupon, useCart, useRemoveCartItem, useRemoveCoupon, useUpdateCartItemQuantity } from '@/hooks/use-cart';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api-client';
import { getCartLineDisplay } from '@/lib/cart-display-cache';
import type { CartItemView } from '@/lib/cart-schemas';
import { humanize } from '@/lib/facets';

/**
 * Cart — plan.md §15.5. Now wired to the real `cart` module (`useCart` +
 * mutations, `hooks/use-cart.ts`) instead of `useCartStore`'s local state.
 * Totals shown here are exactly `CartResponse.totals` — plan.md §8.5: "the
 * client never sends or trusts a total" — nothing here is recomputed;
 * `subtotal`/`discount`/`shipping`/`tax`/`grand total` are rendered
 * verbatim from the server. Coupon rejection reasons are the API's own
 * `error.message` (plan.md §8.3: "a specific human reason"), not a
 * generic string.
 */
export default function CartPage() {
  const locale = useLocale() as 'en' | 'ar';
  const { data: cart, isPending, isError, error, refetch } = useCart();

  if (isPending) {
    return (
      <div className="flex flex-col items-center gap-16 px-24 py-96 text-center">
        <p className="font-body text-body text-ink-70">Loading your bag…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-16 px-24 py-96 text-center">
        <h1 className="font-display text-heading-1 tracking-display text-ink">Your bag</h1>
        <p className="font-body text-body text-ink-70">
          {error instanceof ApiError ? error.message : "We couldn't load your bag. Please try again."}
        </p>
        <Button variant="secondary" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-24 px-24 py-96 text-center">
        <h1 className="font-display text-heading-1 tracking-display text-ink">Your bag is empty</h1>
        <p className="max-w-[40ch] font-body text-body text-ink-70">
          Start with what&apos;s new in, or go straight to one of the three stitching worlds.
        </p>
        <div className="flex flex-wrap justify-center gap-16">
          <Link href="/shop/new-in" className="font-body text-body text-ink underline decoration-1 underline-offset-4">
            New In
          </Link>
          <Link href="/shop/unstitched" className="font-body text-body text-ink underline decoration-1 underline-offset-4">
            Unstitched
          </Link>
          <Link href="/shop/pret" className="font-body text-body text-ink underline decoration-1 underline-offset-4">
            Ready to Wear
          </Link>
          <Link
            href="/shop/formal-wedding"
            className="font-body text-body text-ink underline decoration-1 underline-offset-4"
          >
            Formal &amp; Wedding
          </Link>
        </div>
      </div>
    );
  }

  const { totals } = cart;

  return (
    <div className="flex flex-col gap-32 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <h1 className="font-display text-heading-1 tracking-display text-ink">Your bag</h1>

      <div className="flex flex-col gap-32 lg:flex-row lg:items-start lg:gap-48">
        <ul className="flex flex-1 flex-col divide-y divide-line border-y border-line">
          {cart.items.map((item) => (
            <CartLine key={item.id} item={item} locale={locale} />
          ))}
        </ul>

        <div className="flex w-full flex-col gap-24 lg:w-[360px] lg:shrink-0">
          <p className="font-body text-body-sm text-ink-70">
            {totals.shippingFils === 0
              ? "You've unlocked free delivery."
              : 'Free delivery unlocks above a minimum order value.'}
          </p>

          <CouponForm appliedCoupon={cart.appliedCoupons[0]} />

          <dl className="flex flex-col gap-12 border-y border-line py-24">
            <SummaryRow label="Subtotal" valueFils={totals.subtotalFils} locale={locale} />
            {totals.discountFils > 0 ? (
              <SummaryRow label="Discount" valueFils={-totals.discountFils} locale={locale} muted />
            ) : null}
            <SummaryRow
              label="Shipping"
              valueLabel={totals.shippingFils === 0 ? 'Free' : undefined}
              valueFils={totals.shippingFils === 0 ? undefined : totals.shippingFils}
              locale={locale}
            />
            <SummaryRow label="VAT (included)" valueFils={totals.taxFils} locale={locale} muted />
            <dt className="sr-only">Total</dt>
            <div className="flex items-baseline justify-between pt-8 font-body text-heading-2 font-semibold text-ink">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(totals.grandTotalFils, locale)}</span>
            </div>
          </dl>

          <Button asChild variant="primary">
            <Link href="/checkout">Checkout</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function CouponForm({ appliedCoupon }: { appliedCoupon?: { code: string; amountFils: number } | undefined }) {
  const [code, setCode] = useState('');
  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();

  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between gap-16 border border-zamurrad bg-zamurrad/5 px-16 py-12">
        <span className="font-body text-body-sm font-medium text-ink">
          Code <span className="uppercase">{appliedCoupon.code}</span> applied
        </span>
        <button
          type="button"
          onClick={() => removeCoupon.mutate()}
          disabled={removeCoupon.isPending}
          className="font-body text-body-sm text-mukaish underline decoration-1 underline-offset-4 hover:text-ink"
        >
          {removeCoupon.isPending ? 'Removing…' : 'Remove'}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!code.trim()) return;
        applyCoupon.mutate(code.trim(), { onSuccess: () => setCode('') });
      }}
      className="flex flex-col gap-8"
    >
      <div className="flex gap-8">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Discount code"
          aria-label="Discount code"
          className="h-[48px] flex-1 border-0 border-b border-ink-20 bg-nacre px-16 font-body text-body text-ink outline-none focus:border-b-2 focus:border-zamurrad"
        />
        <Button type="submit" variant="secondary" disabled={applyCoupon.isPending || !code.trim()}>
          {applyCoupon.isPending ? 'Applying…' : 'Apply'}
        </Button>
      </div>
      {applyCoupon.isError ? (
        <p role="alert" className="font-body text-body-sm text-danger">
          {applyCoupon.error instanceof ApiError ? applyCoupon.error.message : 'That code could not be applied.'}
        </p>
      ) : null}
    </form>
  );
}

function SummaryRow({
  label,
  valueFils,
  valueLabel,
  locale,
  muted,
}: {
  label: string;
  valueFils?: number | undefined;
  valueLabel?: string | undefined;
  locale: 'en' | 'ar';
  muted?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between font-body text-body-sm ${muted ? 'text-mukaish' : 'text-ink'}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{valueLabel ?? (valueFils != null ? formatMoney(valueFils, locale) : '—')}</dd>
    </div>
  );
}

function CartLine({ item, locale }: { item: CartItemView; locale: 'en' | 'ar' }) {
  const display = getCartLineDisplay(item.variantId);
  const updateQuantity = useUpdateCartItemQuantity();
  const removeItem = useRemoveCartItem();
  const isOverStock = item.availableStock < item.quantity;

  const title = display?.title ?? 'Item';
  const image = display?.image ?? { src: '/catalogue/placeholder.svg', alt: title };
  const href = display?.productSlug ? `/product/${display.productSlug}` : '/shop/new-in';

  return (
    <li className="flex gap-16 py-24">
      <Link href={href} className="relative aspect-[3/4] w-96 shrink-0 overflow-hidden bg-pearl">
        <Image src={image.src} alt={image.alt} fill sizes="96px" className="object-cover" />
      </Link>
      <div className="flex flex-1 flex-col gap-8">
        <div className="flex items-start justify-between gap-16">
          <div className="flex flex-col gap-4">
            {display?.brandName ? (
              <span className="font-body text-label font-semibold tracking-label text-mukaish uppercase">
                {display.brandName}
              </span>
            ) : null}
            <Link href={href} className="font-body text-body font-medium text-ink">
              {title}
            </Link>
            <span className="font-body text-body-sm text-mukaish">
              {[display?.stitchingType ? humanize(display.stitchingType) : null, display?.colorName, display?.size]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {item.priceChanged ? <span className="font-body text-body-sm text-garnet">Price updated since you added this.</span> : null}
            {isOverStock ? (
              <span className="font-body text-body-sm text-garnet">
                {item.availableStock === 0 ? 'No longer in stock.' : `Only ${item.availableStock} left — update quantity.`}
              </span>
            ) : null}
          </div>
          <span className="whitespace-nowrap font-body text-price font-semibold tabular-nums text-ink">
            {formatMoney(item.unitPriceFils * item.quantity, locale)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-16">
          <QuantityStepper
            label={`Quantity for ${title}`}
            quantity={item.quantity}
            onChange={(quantity) => updateQuantity.mutate({ itemId: item.id, quantity })}
            max={Math.max(item.quantity, item.availableStock, 1)}
          />
          <button
            type="button"
            onClick={() => removeItem.mutate(item.id)}
            disabled={removeItem.isPending}
            className="font-body text-body-sm text-mukaish underline decoration-1 underline-offset-4 hover:text-ink"
          >
            {removeItem.isPending ? 'Removing…' : 'Remove'}
          </button>
        </div>
        {updateQuantity.isError ? (
          <p role="alert" className="font-body text-body-sm text-danger">
            {updateQuantity.error instanceof ApiError ? updateQuantity.error.message : 'Could not update quantity.'}
          </p>
        ) : null}
      </div>
    </li>
  );
}
