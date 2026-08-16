import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

/**
 * Server-side message loading per request — plan.md §16, §4.1 (`next-intl`,
 * "App Router native, RSC-compatible"). Falls back to the default locale
 * rather than 404ing on an unrecognised locale segment; `[locale]/layout.tsx`
 * is what actually 404s on a genuinely invalid segment.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
