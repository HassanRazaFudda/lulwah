const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
const DEFAULT_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DEFAULT_DATE_OPTIONS,
  hour: 'numeric',
  minute: '2-digit',
};

/**
 * Thin `Intl.DateTimeFormat` wrapper — Gregorian calendar always. The plan
 * uses Gregorian dates throughout (order timelines, `placedAt`, etc.);
 * `calendar: 'gregory'` pins that explicitly for `ar-AE` too, since
 * leaving it to the locale default is exactly the kind of implicit
 * behaviour that quietly breaks when ICU data changes.
 */
export function formatDate(
  date: Date | string,
  locale: 'en' | 'ar',
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  const intlLocale = locale === 'ar' ? 'ar-AE' : 'en-AE';
  return new Intl.DateTimeFormat(intlLocale, { ...options, calendar: 'gregory' }).format(value);
}

/** `formatDate` plus a time component — for order timelines and admin tables. */
export function formatDateTime(date: Date | string, locale: 'en' | 'ar'): string {
  return formatDate(date, locale, DEFAULT_DATE_TIME_OPTIONS);
}
