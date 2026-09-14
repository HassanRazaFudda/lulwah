import type { Config } from 'tailwindcss';
import {
  clampFontSize,
  colorAlphas,
  colors,
  duration,
  durationMs,
  ease,
  letterSpacing,
  spacing,
  typeScale,
  type TypeScaleToken,
} from '@lulwah/tokens';

/**
 * Tailwind v4 preset — plan.md §13.2 banned list + §13.3/§13.4/§13.5/§14.2.
 *
 * `theme.colors`, `theme.spacing`, `theme.fontSize`, `theme.borderRadius`,
 * `theme.transitionTimingFunction` and `theme.transitionDuration` are
 * REPLACED here, not extended under `theme.extend`: Tailwind's default
 * palette (`gray-500`, `blue-600`, `indigo-*`, ...), its default spacing
 * scale, and its default `rounded-2xl`/arbitrary-easing defaults must not
 * be typeable anywhere in the codebase (§13.2 "Default Tailwind palette
 * ... removed from the Tailwind config so they cannot be typed").
 *
 * Every value is sourced from `@lulwah/tokens` — never duplicated here as
 * a raw hex code or magic number.
 *
 * Consuming apps wire this in as a preset, e.g.:
 *
 *   // tailwind.config.ts
 *   import preset from '@lulwah/config/tailwind-preset';
 *   export default { presets: [preset], content: [...] };
 */
const fontSizeTheme = Object.fromEntries(
  (Object.keys(typeScale) as TypeScaleToken[]).map((step) => [
    step,
    [clampFontSize(step), { lineHeight: String(typeScale[step].lineHeight) }] as const,
  ]),
) as Record<TypeScaleToken, readonly [string, { lineHeight: string }]>;

const preset = {
  content: [],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      ink: colors.ink,
      'ink-70': colorAlphas.ink70,
      'ink-20': colorAlphas.ink20,
      paper: colors.paper,
      pearl: colors.pearl,
      nacre: colors.nacre,
      zamurrad: colors.zamurrad,
      'zamurrad-deep': colors.zamurradDeep,
      'gold-dark': colors.goldDark,
      gold: colors.gold,
      'gold-light': colors.goldLight,
      garnet: colors.garnet,
      plum: colors.plum,
      mukaish: colors.mukaish,
      line: colorAlphas.line,
      success: colors.success,
      warning: colors.warning,
      danger: colors.danger,
    },
    spacing,
    fontSize: fontSizeTheme,
    fontFamily: {
      display: ['"Bodoni Moda"', 'serif'],
      body: ['Archivo', 'sans-serif'],
      'display-ar': ['"Aref Ruqaa"', 'serif'],
      'body-ar': ['"IBM Plex Sans Arabic"', 'sans-serif'],
    },
    letterSpacing: {
      normal: '0em',
      label: letterSpacing.label,
      display: letterSpacing.display,
    },
    // Radius 0 everywhere by default (product media, panels); 2px is the
    // one exception, reserved for buttons/inputs only (§13.2, §13.6).
    borderRadius: {
      none: '0px',
      DEFAULT: '0px',
      sm: '2px',
    },
    // Only the four locked motion tokens (§14.2) — no ad-hoc durations or
    // easing curves. GSAP/Motion-driven animation reads these same values
    // from @lulwah/tokens directly rather than through Tailwind classes.
    transitionTimingFunction: {
      out: ease.out,
      'in-out': ease.inOut,
      cloth: ease.cloth,
    },
    transitionDuration: {
      fast: durationMs.fast,
      base: durationMs.base,
      slow: durationMs.slow,
      cloth: durationMs.cloth,
    },
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [],
} satisfies Config;

/** Re-exported for JS-driven animation code that wants raw ms numbers rather than a Tailwind class. */
export const motionDurationMs = duration;

export default preset;
