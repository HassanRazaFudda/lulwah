import { defineRouting } from 'next-intl/routing';

/**
 * Locale routing — plan.md §16. `/en` and `/ar` are both explicit path
 * prefixes (`localePrefix: 'always'`) so a bare `/` always redirects based
 * on `Accept-Language` rather than silently serving English at the root;
 * next-intl persists the resolved choice in a cookie on every request.
 */
export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type AppLocale = (typeof routing.locales)[number];
