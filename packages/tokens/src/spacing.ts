/**
 * Spacing scale — plan.md §13.5: "Spacing scale: 4 8 12 16 24 32 48 64 96
 * 128 160 px only." Nothing ad-hoc. Keys are the raw px numbers (as
 * strings) so this object drops straight into Tailwind's `theme.spacing`
 * — `p-24` then resolves to exactly `24px`, and no other spacing value is
 * reachable through a utility class.
 */
export const spacing = {
  // Not part of plan.md §13.5's named scale, but structurally necessary:
  // Tailwind's spacing-derived utilities (`inset-0`, `top-0`, `p-0`,
  // `gap-0`, ...) resolve against this object, and this preset REPLACES
  // Tailwind's default scale rather than extending it (see
  // tailwind-preset.ts's doc comment) -- so without an explicit `0` key,
  // every `-0` utility in the entire app silently fails to generate.
  // Concretely: `next/image`'s `fill` layout depends on a `absolute
  // inset-0` parent, and every ProductCard image was invisible because
  // of exactly this (0 isn't a spacing *choice*, so it doesn't compete
  // with the locked scale's intent).
  '0': '0px',
  '4': '4px',
  '8': '8px',
  '12': '12px',
  '16': '16px',
  '24': '24px',
  '32': '32px',
  '48': '48px',
  '64': '64px',
  '96': '96px',
  '128': '128px',
  '160': '160px',
} as const satisfies Record<string, string>;

export type SpacingToken = keyof typeof spacing;

/** The same scale as a sorted number list, for code that needs to pick the
 *  nearest allowed step (e.g. a design-QA lint script) rather than a CSS
 *  value string. */
export const spacingScalePx = [0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160] as const;
