import type { Metadata } from 'next';
import { Button } from '@lulwah/ui';
import { Link, redirect } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { getCheckoutSession } from '@/lib/checkout-client';

/**
 * Ziina's hosted-redirect return target — `success_url`/`cancel_url`/
 * `failure_url` (docs/ziina-integration-notes.md §1/§3), built server-side
 * by `checkout.service.ts#buildCheckoutReturnUrls` and keyed by checkout
 * session id, not order number: an order number doesn't exist yet at
 * payment-intent-creation time (`POST .../payment-intent` runs before
 * `place()` ever creates the `Order` — see that function's own doc
 * comment). This page's only job is to read `?result=` back off the URL
 * Ziina sent the browser to, and resolve "what order came from this
 * session" via the already-public `GET /checkout/session/:id`, which now
 * exposes `orderNumber` once `place()` has run (set by `checkout
 * .repository.ts#markCompleted` — no new endpoint needed).
 *
 * A Server Component, not a client one (unlike `confirmation/[order]`) —
 * `getCheckoutSession` needs no cookie/auth (checkout is public throughout,
 * plan.md §15.6), so the lookup and the `result=success` redirect both
 * happen server-side, with no client-side fetch-then-flash-then-navigate
 * step. Uses `@/i18n/navigation#redirect` (next-intl's locale-aware
 * wrapper), not the bare `next/navigation#redirect` — a real bug caught
 * live: the bare version builds a locale-less `Location` header
 * (`/checkout/confirmation/...`), which still eventually lands on the right
 * page because `middleware.ts`'s `localePrefix: 'always'` catches it and
 * redirects again — but that's a second, avoidable 307 hop for a customer
 * who already just made two cross-domain round trips (out to Ziina, back
 * here). Passing this page's own `locale` route param explicitly builds the
 * correctly-prefixed URL (`/en/checkout/confirmation/...`) in one hop.
 *
 * IMPORTANT: this redirect is UX only, never the source of truth for order
 * confirmation (docs/ziina-integration-notes.md §1: "the webhook... is the
 * source of truth"). `result=success` does not itself mean the payment is
 * confirmed — only that Ziina's hosted page finished without the customer
 * cancelling or a hard failure. This page never fabricates a "confirmed"
 * message on the strength of the redirect alone: for `result=success` it
 * hands off entirely to the existing confirmation page
 * (`checkout/confirmation/[order]`), which renders whatever the order's
 * real status actually is — `pending_payment` until Ziina's webhook
 * (`payment.service.ts#handleZiinaWebhook`) confirms it, same as any other
 * order.
 *
 * No "retry payment" flow exists here for `cancel`/`failure` — deliberately
 * out of scope. `place()` already converted the cart and cleared
 * reservations the moment the order was created, before the browser was
 * ever sent to Ziina, so there is nothing left in the bag to resume — a
 * genuine retry would need a new create-intent-for-an-existing-order code
 * path that doesn't exist anywhere in this codebase. This page says so
 * plainly (order not completed, bag already cleared) rather than
 * pretending a retry is possible.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

type ZiinaResult = 'success' | 'cancel' | 'failure';

interface CheckoutReturnPageProps {
  params: Promise<{ locale: AppLocale; sessionId: string }>;
  searchParams: Promise<{ result?: string }>;
}

export default async function CheckoutReturnPage({ params, searchParams }: CheckoutReturnPageProps) {
  const { locale, sessionId } = await params;
  const { result: rawResult } = await searchParams;
  const result: ZiinaResult = rawResult === 'success' ? 'success' : rawResult === 'cancel' ? 'cancel' : 'failure';

  // A missing/expired session (a stale bookmark reused well after the
  // checkout window, or a genuinely bad id) still needs an honest page
  // here, never a 500 — `orderNumber` just stays `null` and falls through
  // to the messaging below, same as any other lookup miss.
  const orderNumber: string | null = await getCheckoutSession(sessionId)
    .then((session) => session.orderNumber)
    .catch(() => null);

  if (result === 'success' && orderNumber) {
    // No client-side flash — this is a real server redirect straight to
    // the existing confirmation page, which does its own fresh lookup of
    // the order's actual current status. `locale` passed explicitly (this
    // page's own route param) rather than relying on inference.
    redirect({ href: `/checkout/confirmation/${orderNumber}`, locale });
  }

  if (result === 'success') {
    // Shouldn't happen by this module's own design (place() always sets
    // orderNumber on the session before the browser is ever sent to
    // Ziina) — but a real possible state regardless (session document
    // expired/deleted, a stale/tampered link), so it gets its own honest
    // message rather than being folded into the cancel/failure copy below.
    return (
      <StatusMessage
        title="We couldn't find your order"
        body="Your payment may still have gone through — check your email for a confirmation, or contact us with your payment reference if you were charged."
      />
    );
  }

  return (
    <StatusMessage
      title={result === 'cancel' ? 'Payment cancelled' : 'Payment did not go through'}
      body="Your order was not completed, and your bag has already been cleared. Nothing was charged if you cancelled before entering your card details. Please start again from your bag."
    />
  );
}

function StatusMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center gap-16 px-24 py-96 text-center">
      <h1 className="font-display text-heading-1 tracking-display text-ink">{title}</h1>
      <p className="max-w-[46ch] font-body text-body text-ink-70">{body}</p>
      <div className="mt-8 flex gap-16">
        <Button asChild variant="primary">
          <Link href="/shop/new-in">Continue shopping</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Go to homepage</Link>
        </Button>
      </div>
    </div>
  );
}
