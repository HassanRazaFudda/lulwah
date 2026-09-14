/**
 * Colour tokens — plan.md §13.3 (locked). This is the single source of
 * truth for every hex value in the system: the Tailwind preset
 * (`packages/config/tailwind-preset.ts`) removes Tailwind's default
 * palette and rebuilds `theme.colors` from exactly these values, so
 * `gray-500` / `blue-600` / `indigo-*` etc. cannot be typed anywhere in
 * the codebase (§13.2 banned list).
 *
 * Usage law (§13.3, revised): gold is metal, not paint — hairlines, focus
 * rings, never a large fill. Emerald is the only large colour block.
 * Garnet appears only on sale/discount markers. **Plum is reserved for the
 * logo mark and wordmark only** — this correction supersedes the original
 * law's "gold ... the monogram" clause, written before any real logo
 * existed.
 *
 * `plum`/`plumDark` are sourced from the client-provided `LULWAH.pdf`/
 * `LULWAH.ai`, and corrected once already: the first pass converted the
 * PDF's own embedded CMYK fill operators to RGB with the naive formula
 * (`R=255×(1-C)×(1-K)` etc.) and landed on `#20007B` — visibly too blue/
 * saturated once actually compared side by side against the source file,
 * because that formula doesn't reproduce the colour-managed conversion a
 * real design tool applies. Replaced with the client's own eyedropper-
 * sampled values, reported directly: `plum` (`#411956`) for the "LF"
 * monogram, "FASHION" and both hairlines; `plumDark` (`#310C3C`, a touch
 * darker) for "LULWAH" specifically — genuinely two close but distinct
 * shades in the source mark, not a rounding artifact. Everything else
 * stays paper, pearl and ink; the clothes bring the colour.
 */
export const colors = {
  ink: '#131311',
  paper: '#FFFFFF',
  pearl: '#EDEDEA',
  nacre: '#F7F7F5',
  zamurrad: '#0E3B30',
  zamurradDeep: '#08221C',
  goldDark: '#B8862B',
  gold: '#D9AE4A',
  goldLight: '#F2E0A8',
  garnet: '#8A2B36',
  plum: '#411956',
  plumDark: '#310C3C',
  mukaish: '#8E9086',
  success: '#1F6B4A',
  warning: '#A9761A',
  danger: '#A32A2A',
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Translucent variants of `ink`, expressed as `rgb()` so the alpha is
 * exact rather than a rounded hex8: `--ink-70` (§13.3, secondary type),
 * `--line` (§13.3, 14% ink hairline rules), and `--ink-20` (§13.6, the
 * Input component's resting bottom rule before focus).
 */
export const colorAlphas = {
  ink70: 'rgba(19, 19, 17, 0.70)',
  ink20: 'rgba(19, 19, 17, 0.20)',
  line: 'rgba(19, 19, 17, 0.14)',
} as const;

export type ColorAlphaToken = keyof typeof colorAlphas;
