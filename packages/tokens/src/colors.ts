/**
 * Colour tokens — plan.md §13.3 (locked). This is the single source of
 * truth for every hex value in the system: the Tailwind preset
 * (`packages/config/tailwind-preset.ts`) removes Tailwind's default
 * palette and rebuilds `theme.colors` from exactly these values, so
 * `gray-500` / `blue-600` / `indigo-*` etc. cannot be typed anywhere in
 * the codebase (§13.2 banned list).
 *
 * Usage law (§13.3): gold is metal, not paint — hairlines, the monogram,
 * focus rings, never a large fill. Emerald is the only large colour block.
 * Garnet appears only on sale/discount markers. Everything else is paper,
 * pearl and ink; the clothes bring the colour.
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
