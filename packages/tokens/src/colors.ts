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
 * existed. `plum` is not a designer's guess: it's extracted directly from
 * the client-provided `LULWAH.pdf`/`LULWAH.ai` — both files fill the "LF"
 * monogram, "LULWAH", "FASHION" and the flanking hairlines with one of two
 * near-identical CMYK values (`0.8 0.98 0.373 0.533 k` for the "LULWAH"
 * text, `0.812 1 0.275 0.333 k` for everything else in the mark), found by
 * inflating the PDF's own FlateDecode content stream and reading its real
 * fill operators — not eyeballed off a rendered preview. Converted to RGB,
 * these round to the same visible plum; `#20007B` (the more common of the
 * two, covering the monogram + "FASHION" + both hairlines) is used as the
 * single on-screen value throughout. Everything else stays paper, pearl
 * and ink; the clothes bring the colour.
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
  plum: '#20007B',
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
