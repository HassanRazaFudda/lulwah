'use client';

import { formatMoney } from '@lulwah/utils';
import { Button } from '@lulwah/ui';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { QuantityStepper } from '@/components/commerce/QuantityStepper';
import { Link } from '@/i18n/navigation';
import { computeCartTotals } from '@/lib/cart-totals';
import { FREE_SHIPPING_THRESHOLD_FILS, STANDARD_SHIPPING_FILS } from '@/lib/commerce-constants';
import { humanize } from '@/lib/facets';
import { useCartStore, type CartLineItem } from '@/stores/cart-store';

/**
 * Cart — plan.md §15.5. `apps/api`'s cart module isn't wired up (Out of
 * scope note: "cart/checkout can use local component state / placeholder
 * data"), so this reads `useCartStore` directly rather than TanStack Query
 * — §12.3's "Cart / Checkout / Account | Client, auth-guarded, no-store"
 * rendering strategy already calls for CSR here, so a client component
 * with no server round trip is the correct shape even before the real
 * cart API exists.
 */
export default function CartPage() {
  const locale = useLocale() as 'en' | 'ar';
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  const totals = computeCartTotals(items);
  const freeShippingProgress =
    totals.freeShippingRemainderFils === 0 ? 1 : 1 - totals.freeShippingRemainderFils / FREE_SHIPPING_THRESHOLD_FILS;

  if (items.length === 0) {
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

  return (
    <div className="flex flex-col gap-32 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <h1 className="font-display text-heading-1 tracking-display text-ink">Your bag</h1>

      <div className="flex flex-col gap-32 lg:flex-row lg:items-start lg:gap-48">
        <ul className="flex flex-1 flex-col divide-y divide-line border-y border-line">
          {items.map((item) => (
            <CartLine key={item.id} item={item} locale={locale} onQuantityChange={updateQuantity} onRemove={removeItem} />
          ))}
        </ul>

        <div className="flex w-full flex-col gap-24 lg:w-[360px] lg:shrink-0">
          <div className="flex flex-col gap-8">
            <p className="font-body text-body-sm text-ink-70">
              {totals.freeShippingRemainderFils > 0
                ? `${formatMoney(totals.freeShippingRemainderFils, locale)} away from free delivery.`
                : "You've unlocked free delivery."}
            </p>
            <div className="h-px w-full bg-line" aria-hidden="true">
              <div
                className="h-px bg-gold-dark transition-[width] duration-base ease-out"
                style={{ width: `${Math.min(freeShippingProgress, 1) * 100}%` }}
              />
            </div>
          </div>

          <dl className="flex flex-col gap-12 border-y border-line py-24">
            <SummaryRow label="Subtotal" valueFils={totals.subtotalFils} locale={locale} />
            <SummaryRow
              label="Shipping"
              valueLabel={
                totals.shippingFils === 0 ? `Free — you saved ${formatMoney(STANDARD_SHIPPING_FILS, locale)}` : undefined
              }
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

function CartLine({
  item,
  locale,
  onQuantityChange,
  onRemove,
}: {
  item: CartLineItem;
  locale: 'en' | 'ar';
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="flex gap-16 py-24">
      <Link href={`/product/${item.productSlug}`} className="relative aspect-[3/4] w-96 shrink-0 overflow-hidden bg-pearl">
        <Image src={item.image.src} alt={item.image.alt} fill sizes="96px" className="object-cover" />
      </Link>
      <div className="flex flex-1 flex-col gap-8">
        <div className="flex items-start justify-between gap-16">
          <div className="flex flex-col gap-4">
            <span className="font-body text-label font-semibold tracking-label text-mukaish uppercase">
              {item.brandName}
            </span>
            <Link href={`/product/${item.productSlug}`} className="font-body text-body font-medium text-ink">
              {item.title}
            </Link>
            <span className="font-body text-body-sm text-mukaish">
              {[humanize(item.stitchingType), item.colorName, item.size].filter(Boolean).join(' · ')}
            </span>
          </div>
          <span className="whitespace-nowrap font-body text-price font-semibold tabular-nums text-ink">
            {formatMoney(item.unitPriceFils * item.quantity, locale)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-16">
          <QuantityStepper
            label={`Quantity for ${item.title}`}
            quantity={item.quantity}
            onChange={(quantity) => onQuantityChange(item.id, quantity)}
          />
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="font-body text-body-sm text-mukaish underline decoration-1 underline-offset-4 hover:text-ink"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
