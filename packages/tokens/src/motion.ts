/**
 * Motion tokens — plan.md §14.2: "Easing & duration (tokens — no ad-hoc
 * values)." No bounce, no elastic, no spring overshoot anywhere — couture
 * doesn't bounce.
 */
export const ease = {
  /** Default for entrances. */
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** For moves (position/layout changes). */
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  /** Signature curve: slow settle, fabric-like. Used for "The Dupatta" and cloth-adjacent moments. */
  cloth: 'cubic-bezier(0.16, 1, 0.30, 1)',
} as const;

export type EaseToken = keyof typeof ease;

/** Durations in milliseconds, for JS-driven animation (GSAP timelines, Motion). */
export const duration = {
  fast: 160,
  base: 280,
  slow: 480,
  cloth: 900,
} as const;

export type DurationToken = keyof typeof duration;

/** Same durations as CSS time strings, for `transition-duration` etc. */
export const durationMs = {
  fast: '160ms',
  base: '280ms',
  slow: '480ms',
  cloth: '900ms',
} as const satisfies Record<DurationToken, string>;

/** Stagger interval for list/grid entrance animations — batches after 8 items. */
export const stagger = {
  intervalMs: 45,
  maxItems: 8,
} as const;
