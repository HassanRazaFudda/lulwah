/**
 * Slugifies a title into a URL-safe, lowercase, hyphen-separated string —
 * used for `products.slug`, `categories.slug`, `collections.slug` etc.
 * (plan.md §7: "slug unique + indexed where public").
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '') // strip diacritics left by NFKD decomposition, e.g. "Ferozi" accented variants
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
