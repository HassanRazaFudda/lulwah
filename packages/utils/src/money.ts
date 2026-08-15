// Arabic-Indic numerals via the `-u-nu-arab` Unicode locale extension,
// rather than an Intl.NumberFormatOptions field — keeps this compatible
// with the target ES2023 Intl lib types without an extra `as` cast.
const AR_AE_ARABIC_DIGITS_LOCALE = 'ar-AE-u-nu-arab';
const EN_AE_LOCALE = 'en-AE';

/**
 * Formats an integer fils amount as a display string — plan.md §8.1.
 *
 * `AED 249.50` for `locale: 'en'`, `‏د.إ ٢٤٩٫٥٠`-style Arabic-Indic
 * numerals for `locale: 'ar'` (via `Intl.NumberFormat('ar-AE')`).
 * Rounding happens **only** here, at final display — half-up. This is the
 * one formatter in the codebase; money is never `parseFloat`'d anywhere
 * else, and it always arrives from the database as an integer.
 */
export function formatMoney(fils: number, locale: 'en' | 'ar'): string {
  if (!Number.isFinite(fils)) {
    throw new RangeError(`formatMoney: fils must be a finite number, got ${fils}`);
  }
  const aed = Math.round(fils) / 100;
  const intlLocale = locale === 'ar' ? AR_AE_ARABIC_DIGITS_LOCALE : EN_AE_LOCALE;
  return new Intl.NumberFormat(intlLocale, { style: 'currency', currency: 'AED' }).format(aed);
}
