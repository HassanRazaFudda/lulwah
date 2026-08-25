'use client';

import { formatMoney } from '@lulwah/utils';
import Image from 'next/image';
import type { CheckoutSessionResponse } from '@/lib/checkout-schemas';

/**
 * plan.md §15.6: "Right column: sticky order summary with editable
 * quantities, coupon field, and the full money breakdown." Now driven by
 * the real checkout session (`POST /checkout/session` snapshots the cart —
 * plan.md §7.11's "snapshot rule" — so `session.items[].titleSnapshot/
 * brandSnapshot/imageSnapshot` are real display data straight from the API,
 * unlike the raw cart's `CartItem`, see `cart-display-cache.ts`'s doc
 * comment). Editable quantities live on the cart page, not here — plan.md
 * §15.6's own flow has checkout start from a locked cart; this summary is
 * read-only, matching `checkout.service.ts`'s snapshot-at-session-creation
 * design. Totals are exactly `session.totals` — never recomputed here.
 */
export interface OrderSummaryProps {
  locale: 'en' | 'ar';
  session: CheckoutSessionResponse | null;
}

export function OrderSummary({ locale, session }: OrderSummaryProps) {
  if (!session) {
    return (
      <div className="flex flex-col gap-16 lg:sticky lg:top-96">
        <h2 className="font-body text-label font-semibold tracking-label text-ink uppercase">Order summary</h2>
        <p className="font-body text-body-sm text-mukaish">Loading your order…</p>
      </div>
    );
  }

  const { totals } = session;

  return (
    <div className="flex flex-col gap-16 lg:sticky lg:top-96">
      <h2 className="font-body text-label font-semibold tracking-label text-ink uppercase">Order summary</h2>
      <ul className="flex flex-col gap-16 border-b border-line pb-16">
        {session.items.map((item) => (
          <li key={item.variantId} className="flex gap-12">
            <div className="relative aspect-[3/4] w-[56px] shrink-0 overflow-hidden bg-pearl">
              <Image
                src={item.imageSnapshot || '/catalogue/placeholder.svg'}
                alt={item.titleSnapshot}
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-4">
              <span className="font-body text-body-sm font-medium text-ink">{item.titleSnapshot}</span>
              <span className="font-body text-body-sm text-mukaish">Qty {item.quantity}</span>
            </div>
            <span className="whitespace-nowrap font-body text-body-sm tabular-nums text-ink">
              {formatMoney(item.unitPriceFils * item.quantity, locale)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="flex flex-col gap-8 border-b border-line pb-16 font-body text-body-sm">
        <Row label="Subtotal" value={formatMoney(totals.subtotalFils, locale)} />
        {totals.discountFils > 0 ? <Row label="Discount" value={`-${formatMoney(totals.discountFils, locale)}`} /> : null}
        <Row
          label="Shipping"
          value={session.shippingMethod === null ? 'Calculated next' : totals.shippingFils === 0 ? 'Free' : formatMoney(totals.shippingFils, locale)}
        />
        {totals.codFeeFils > 0 ? <Row label="COD fee" value={formatMoney(totals.codFeeFils, locale)} /> : null}
        <Row label="VAT (included)" value={formatMoney(totals.taxFils, locale)} muted />
      </dl>

      <div className="flex items-baseline justify-between font-body text-heading-2 font-semibold text-ink">
        <span>Total</span>
        <span className="tabular-nums">{formatMoney(totals.grandTotalFils, locale)}</span>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${muted ? 'text-mukaish' : 'text-ink'}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
