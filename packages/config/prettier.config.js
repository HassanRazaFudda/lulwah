/**
 * Shared Prettier config — plan.md §27.6 (small, reviewable diffs; a
 * consistent style nobody argues about). `prettier-plugin-tailwindcss`
 * sorts class lists into Tailwind's canonical order, which matters once
 * `@lulwah/config/tailwind-preset` classes (zamurrad, gold-dark, ...)
 * are in play alongside layout utilities.
 *
 * @type {import('prettier').Config}
 */
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  proseWrap: 'preserve',
  plugins: ['prettier-plugin-tailwindcss'],
};
