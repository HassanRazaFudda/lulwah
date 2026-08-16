import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';

export const metadata: Metadata = {
  title: 'Your orders',
};

/**
 * Account → Orders — plan.md §15.7. A structural stub: real order history
 * needs the `identity`/`order` API modules (auth session + `GET /orders`)
 * that are out of this workstream's scope. Empty state only.
 */
export default function AccountOrdersPage() {
  return (
    <div className="flex flex-col gap-24 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <h1 className="font-display text-heading-1 tracking-display text-ink">Your orders</h1>
      <div className="flex flex-col items-start gap-8 border-t border-line pt-24">
        <p className="font-body text-body text-ink-70">Sign in to see your order history.</p>
        <p className="font-body text-body-sm text-mukaish">
          Already have an order number?{' '}
          <Link href="/faq" className="text-ink underline decoration-1 underline-offset-4">
            See tracking help
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
