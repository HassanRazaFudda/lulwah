'use client';

import { useState } from 'react';
import { formatMoney } from '@lulwah/utils';
import { Button, Input } from '@lulwah/ui';
import type { Order } from '@lulwah/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api-client';
import { trackOrder } from '@/lib/order-client';
import type { PublicOrderTrackingView } from '@/lib/order-schemas';

/**
 * Order confirmation — plan.md §15.6's confirmation-page spec: order
 * number, status, ETA. `checkout/page.tsx` seeds this page's TanStack
 * Query cache (`['order', orderNumber]`) with the real placed `Order`
 * right before navigating here, so the common path (just checked out)
 * renders the full real order with no extra round trip.
 *
 * There is no login/session in this storefront yet (guest checkout
 * throughout, see the task report), so a page refresh or a shared link
 * loses that in-memory cache — for that case this page falls back to the
 * public `GET /orders/track` lookup (order number + the email/phone used
 * at checkout), which returns `plan.md §8.7.5`'s deliberately reduced view
 * (status/history/shipment/ETA, no money) rather than fabricating totals
 * it no longer has.
 *
 * No `purchase` analytics event is fired here — no analytics event system
 * (gtag/dataLayer/a tracked-event helper) exists anywhere in this
 * codebase to hook into, and the task brief is explicit: don't invent one
 * for this pass.
 */
export default function ConfirmationPage() {
  const params = useParams<{ order: string }>();
  const orderNumber = params.order;
  const locale = useLocale() as 'en' | 'ar';
  const queryClient = useQueryClient();
  const cachedOrder = queryClient.getQueryData<Order>(['order', orderNumber]);

  if (cachedOrder) {
    return <FullConfirmation order={cachedOrder} locale={locale} />;
  }

  return <TrackingLookup orderNumber={orderNumber} />;
}

function FullConfirmation({ order, locale }: { order: Order; locale: 'en' | 'ar' }) {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-32 px-24 py-96">
      <div className="flex flex-col items-center gap-16 text-center">
        <h1 className="font-display text-heading-1 tracking-display text-ink">Thank you — order placed</h1>
        <p className="font-body text-body text-ink-70">
          Order <span className="font-medium text-ink tabular-nums">{order.orderNumber}</span>. A confirmation is on its way
          to {order.guestEmail ?? 'your email'}.
        </p>
        <p className="max-w-[46ch] font-body text-body-sm text-mukaish">
          We pack within 24 hours, hand off to courier, and deliver in {order.shippingMethod.etaMinDays}–
          {order.shippingMethod.etaMaxDays} days across the UAE. Track anytime with your order number and email.
        </p>
      </div>

      <ul className="flex flex-col gap-16 divide-y divide-line border-y border-line">
        {order.items.map((item) => (
          <li key={item.id} className="flex gap-16 pt-16 first:pt-0">
            <div className="relative aspect-[3/4] w-64 shrink-0 overflow-hidden bg-pearl">
              <Image src={item.imageSnapshot || '/catalogue/placeholder.svg'} alt={item.titleSnapshot} fill sizes="64px" className="object-cover" />
            </div>
            <div className="flex flex-1 flex-col gap-4">
              <span className="font-body text-body-sm font-medium text-ink">{item.titleSnapshot}</span>
              <span className="font-body text-body-sm text-mukaish">Qty {item.quantity}</span>
            </div>
            <span className="whitespace-nowrap font-body text-body-sm tabular-nums text-ink">{formatMoney(item.lineTotalFils, locale)}</span>
          </li>
        ))}
      </ul>

      <dl className="flex flex-col gap-8 font-body text-body-sm">
        <SummaryRow label="Subtotal" value={formatMoney(order.subtotalFils, locale)} />
        {order.discountTotalFils > 0 ? <SummaryRow label="Discount" value={`-${formatMoney(order.discountTotalFils, locale)}`} /> : null}
        <SummaryRow label="Shipping" value={order.shippingFils === 0 ? 'Free' : formatMoney(order.shippingFils, locale)} />
        {order.codFeeFils > 0 ? <SummaryRow label="COD fee" value={formatMoney(order.codFeeFils, locale)} /> : null}
        <SummaryRow label="VAT (included)" value={formatMoney(order.taxFils, locale)} muted />
        <div className="flex items-baseline justify-between pt-8 font-body text-heading-2 font-semibold text-ink">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(order.grandTotalFils, locale)}</span>
        </div>
      </dl>

      <div className="flex flex-col gap-8 border-t border-line pt-24 font-body text-body-sm text-ink-70">
        <p className="font-medium text-ink">Delivery address</p>
        <p>
          {order.shippingAddress.firstName} {order.shippingAddress.lastName}
        </p>
        <p>
          {order.shippingAddress.buildingName}
          {order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ''}
          {order.shippingAddress.street ? `, ${order.shippingAddress.street}` : ''}
        </p>
        <p>
          {order.shippingAddress.area}, {order.shippingAddress.emirate.replace(/_/g, ' ')}
        </p>
        <p>{order.shippingAddress.landmark}</p>
        <p className="pt-8">Payment: {order.payment.method === 'cod' ? 'Cash on delivery' : order.payment.method}</p>
      </div>

      <Button asChild variant="secondary" className="mt-8 self-center">
        <Link href="/">Continue shopping</Link>
      </Button>
    </div>
  );
}

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${muted ? 'text-mukaish' : 'text-ink'}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function TrackingLookup({ orderNumber }: { orderNumber: string }) {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [result, setResult] = useState<PublicOrderTrackingView | null>(null);

  const trackMutation = useMutation({
    mutationFn: () => trackOrder(orderNumber, emailOrPhone),
    onSuccess: (order) => setResult(order),
  });

  if (result) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col gap-16 px-24 py-96 text-center">
        <h1 className="font-display text-heading-1 tracking-display text-ink">Order {result.orderNumber}</h1>
        <p className="font-body text-body text-ink-70">Status: {result.status.replace(/_/g, ' ')}</p>
        <p className="max-w-[46ch] self-center font-body text-body-sm text-mukaish">
          Estimated delivery: {result.shippingMethod.etaMinDays}–{result.shippingMethod.etaMaxDays} days from{' '}
          {new Date(result.placedAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}.
        </p>
        <Button asChild variant="secondary" className="mt-8 self-center">
          <Link href="/">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-16 px-24 py-96">
      <h1 className="font-display text-heading-1 tracking-display text-ink text-center">Find your order</h1>
      <p className="text-center font-body text-body-sm text-ink-70">
        We couldn&apos;t find order <span className="tabular-nums text-ink">{orderNumber}</span> in this browser session.
        Enter the email or phone number used at checkout to look it up.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          trackMutation.mutate();
        }}
        className="flex flex-col gap-16"
      >
        <Input
          label="Email or phone"
          value={emailOrPhone}
          onChange={(e) => setEmailOrPhone(e.target.value)}
          autoComplete="email"
        />
        {trackMutation.isError ? (
          <p role="alert" className="font-body text-body-sm text-danger">
            {trackMutation.error instanceof ApiError ? trackMutation.error.message : 'Could not find that order.'}
          </p>
        ) : null}
        <Button type="submit" variant="primary" disabled={!emailOrPhone.trim() || trackMutation.isPending}>
          {trackMutation.isPending ? 'Looking up…' : 'Find order'}
        </Button>
      </form>
    </div>
  );
}
