/**
 * Typography tokens — plan.md §13.4 (locked). Rule: any given screen uses
 * at most three steps from this scale — the contrast between a 96px
 * display and an 11px label is the drama; mid-sized type in between
 * kills it.
 */
export const fontFamilies = {
  /** Bodoni Moda — Didone display face. >=32px only, tight tracking, never for UI. */
  display: '"Bodoni Moda", serif',
  /** Archivo — body/UI, has a `wdth` axis so it isn't the Inter/Geist default. */
  body: '"Archivo", sans-serif',
  /** Aref Ruqaa — calligraphic Arabic display, matches the logo's ornamental register. */
  displayArabic: '"Aref Ruqaa", serif',
  /** IBM Plex Sans Arabic — Arabic body/UI, pairs with Archivo's weight range. */
  bodyArabic: '"IBM Plex Sans Arabic", sans-serif',
} as const;

export type FontFamilyToken = keyof typeof fontFamilies;

/** Letter-spacing tokens: tracked labels/eyebrows (+0.16em) and tight display tracking (-0.02em). */
export const letterSpacing = {
  label: '0.16em',
  display: '-0.02em',
} as const;

interface TypeScaleStep {
  readonly minPx: number;
  readonly maxPx: number;
  readonly lineHeight: number;
  readonly fontFamily: FontFamilyToken;
  readonly fontWeight: number;
  readonly isUppercase?: boolean;
  readonly isTabularNumeric?: boolean;
}

/** The locked mobile-to-desktop scale — plan.md §13.4 table. */
export const typeScale = {
  'display-1': { minPx: 44, maxPx: 96, lineHeight: 0.94, fontFamily: 'display', fontWeight: 400 },
  'display-2': { minPx: 32, maxPx: 64, lineHeight: 1.0, fontFamily: 'display', fontWeight: 400 },
  'heading-1': { minPx: 24, maxPx: 36, lineHeight: 1.15, fontFamily: 'display', fontWeight: 500 },
  'heading-2': { minPx: 19, maxPx: 24, lineHeight: 1.25, fontFamily: 'body', fontWeight: 600 },
  'body-lg': { minPx: 16, maxPx: 18, lineHeight: 1.6, fontFamily: 'body', fontWeight: 400 },
  body: { minPx: 15, maxPx: 16, lineHeight: 1.65, fontFamily: 'body', fontWeight: 400 },
  'body-sm': { minPx: 13, maxPx: 14, lineHeight: 1.55, fontFamily: 'body', fontWeight: 400 },
  label: {
    minPx: 11,
    maxPx: 12,
    lineHeight: 1.2,
    fontFamily: 'body',
    fontWeight: 600,
    isUppercase: true,
  },
  price: { minPx: 16, maxPx: 20, lineHeight: 1.1, fontFamily: 'body', fontWeight: 600, isTabularNumeric: true },
} as const satisfies Record<string, TypeScaleStep>;

export type TypeScaleToken = keyof typeof typeScale;

/**
 * Builds a fluid `clamp()` CSS value for a type-scale step, linearly
 * interpolating between `minPx` at `viewportMinPx` and `maxPx` at
 * `viewportMaxPx` (plan.md §13.4's "mobile → desktop, clamp" scale).
 * Default viewport bounds match the design's mobile/desktop reference
 * widths (375 / 1440).
 */
export function clampFontSize(step: TypeScaleToken, viewportMinPx = 375, viewportMaxPx = 1440): string {
  const { minPx, maxPx } = typeScale[step];
  const slope = (maxPx - minPx) / (viewportMaxPx - viewportMinPx);
  const intersectionPx = minPx - slope * viewportMinPx;
  const preferred = `${intersectionPx.toFixed(4)}px + ${(slope * 100).toFixed(4)}vw`;
  return `clamp(${minPx}px, ${preferred}, ${maxPx}px)`;
}
