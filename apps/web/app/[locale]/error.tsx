'use client';

import { useEffect } from 'react';
import { Button } from '@lulwah/ui';

/**
 * plan.md §3.3 rule 9: "a fetch failure ... needs a real UI state, not a
 * blank page." Every shop/PDP/home page in this app now fetches from a
 * real API for the first time (this workstream) — before, placeholder
 * arrays could never throw. No `error.tsx` existed anywhere in the app
 * (checked before adding this), so an API outage or a malformed response
 * previously would have surfaced Next's raw unstyled default error screen.
 * This is a Client Component per Next's own App Router error-boundary
 * contract (`app/[locale]/error.tsx` catches any rendering/fetch error
 * thrown by a page or layout below it).
 */
export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // No Sentry wiring in this workstream — a console trace beats losing the error entirely.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-16 px-24 py-64 text-center">
      <h1 className="font-display text-heading-1 tracking-display text-ink">Something went wrong</h1>
      <p className="max-w-[480px] font-body text-body text-mukaish">
        We couldn&apos;t load this page. This is usually temporary, so try again in a moment.
      </p>
      <Button type="button" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
