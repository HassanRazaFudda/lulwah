'use client';

import { formatMoney } from '@lulwah/utils';
import Image from 'next/image';
import { computeCartTotals } from '@/lib/cart-totals';
import { COD_FEE_FILS } from '@/lib/commerce-constants';
import { useCartStore } from '@/stores/cart-store';

/** plan.md §15.6: "Right column: sticky order summary with editable quantities, coupon field, and the full money breakdown." */
export interface OrderSummaryProps {
  locale: 'en' | 'ar';
  isCod: boolean;
}

export function OrderSummary({ locale, isCod }: OrderSummaryProps) {
  const items = useCartStore((state) => state.items);
  const totals = computeCartTotals(items);
  const codFeeFils = isCod ? COD_FEE_FILS : 0;
  const grandTotalFils = totals.grandTotalFils + codFeeFils;

  return (
    <div className="flex flex-col gap-16 lg:sticky lg:top-96">
      <h2 className="font-body text-label font-semibold tracking-label text-ink uppercase">Order summary</h2>
      <ul className="flex flex-col gap-16 border-b border-line pb-16">
        {items.map((item) => (
          <li key={item.id} className="flex gap-12">
            <div className="relative aspect-[3/4] w-56 shrink-0 overflow-hidden bg-pearl">
              <Image src={item.image.src} alt={item.image.alt} fill sizes="56px" className="object-cover" />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <span className="font-body text-body-sm font-medium text-ink">{item.title}</span>
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
        <Row label="Shipping" value={totals.shippingFils === 0 ? 'Free' : formatMoney(totals.shippingFils, locale)} />
        {isCod ? <Row label="COD fee" value={formatMoney(codFeeFils, locale)} /> : null}
        <Row label="VAT (included)" value={formatMoney(totals.taxFils, locale)} muted />
      </dl>

      <div className="flex items-baseline justify-between font-body text-heading-2 font-semibold text-ink">
        <span>Total</span>
        <span className="tabular-nums">{formatMoney(grandTotalFils, locale)}</span>
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
