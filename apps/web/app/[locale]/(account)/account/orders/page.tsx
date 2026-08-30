'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Input } from '@lulwah/ui';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api-client';
import { trackOrder } from '@/lib/order-client';
import type { PublicOrderTrackingView } from '@/lib/order-schemas';

/**
 * Account → Orders — plan.md §15.7. The real customer-facing order history
 * (`GET /me/orders`) needs a logged-in session, and this storefront has no
 * auth/login UI yet (no sign-in page, no token storage anywhere in
 * `apps/web` — out of this workstream's scope, see the task report). Guest
 * order tracking (`GET /orders/track`, plan.md §8.7.5 — order number + the
 * email/phone on file, no login, rate-limited 10/min/IP) is the one real,
 * usable order-lookup surface today, so this page is wired to that rather
 * than left as a "sign in to see your orders" dead end.
 */
export default function AccountOrdersPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [result, setResult] = useState<PublicOrderTrackingView | null>(null);

  const trackMutation = useMutation({
    mutationFn: () => trackOrder(orderNumber.trim(), emailOrPhone.trim()),
    onSuccess: (order) => setResult(order),
  });

  return (
    <div className="flex flex-col gap-24 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <h1 className="font-display text-heading-1 tracking-display text-ink">Your orders</h1>

      <div className="flex flex-col gap-24 border-t border-line pt-24">
        <p className="font-body text-body text-ink-70">
          Sign-in isn&apos;t available yet — track an order with your order number and the email or phone used at
          checkout.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setResult(null);
            trackMutation.mutate();
          }}
          className="flex max-w-[480px] flex-col gap-16"
        >
          <Input
            label="Order number"
            hint="e.g. LF-260825-0001"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
          />
          <Input label="Email or phone" value={emailOrPhone} onChange={(e) => setEmailOrPhone(e.target.value)} autoComplete="email" />
          {trackMutation.isError ? (
            <p role="alert" className="font-body text-body-sm text-danger">
              {trackMutation.error instanceof ApiError ? trackMutation.error.message : 'Could not find that order.'}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={!orderNumber.trim() || !emailOrPhone.trim() || trackMutation.isPending}>
            {trackMutation.isPending ? 'Looking up…' : 'Track order'}
          </Button>
        </form>

        {result ? (
          <div className="flex flex-col gap-8 border border-line p-24">
            <p className="font-body text-body font-medium text-ink">Order {result.orderNumber}</p>
            <p className="font-body text-body-sm text-ink-70">Status: {result.status.replace(/_/g, ' ')}</p>
            <p className="font-body text-body-sm text-mukaish">
              Estimated delivery: {result.shippingMethod.etaMinDays}–{result.shippingMethod.etaMaxDays} days from{' '}
              {new Date(result.placedAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}.
            </p>
            {result.deliveredAt ? (
              <p className="font-body text-body-sm text-success">
                Delivered {new Date(result.deliveredAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}.
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="font-body text-body-sm text-mukaish">
          Need more help?{' '}
          <Link href="/faq" className="text-ink underline decoration-1 underline-offset-4">
            See tracking help
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
