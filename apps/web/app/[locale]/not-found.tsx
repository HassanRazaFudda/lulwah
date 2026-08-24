import { Link } from '@/i18n/navigation';

/**
 * Catches every `notFound()` call under `app/[locale]/*` — the PDP and
 * brand-page 404 cases this workstream added (a slug the API 404s on) —
 * plus any unmatched route. No `not-found.tsx` existed anywhere in the app
 * before this (checked); without it Next falls back to its generic
 * unstyled 404, which reads as a broken page rather than a designed state.
 */
export default function LocaleNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-16 px-24 py-64 text-center">
      <h1 className="font-display text-heading-1 tracking-display text-ink">Page not found</h1>
      <p className="max-w-[480px] font-body text-body text-mukaish">
        The page you&apos;re looking for doesn&apos;t exist, or the piece has sold out and been retired.
      </p>
      <Link
        href="/shop/new-in"
        className="font-body text-body text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
      >
        Continue shopping
      </Link>
    </div>
  );
}
