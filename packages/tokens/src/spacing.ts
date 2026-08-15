/**
 * Spacing scale — plan.md §13.5: "Spacing scale: 4 8 12 16 24 32 48 64 96
 * 128 160 px only." Nothing ad-hoc. Keys are the raw px numbers (as
 * strings) so this object drops straight into Tailwind's `theme.spacing`
 * — `p-24` then resolves to exactly `24px`, and no other spacing value is
 * reachable through a utility class.
 */
export const spacing = {
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
export const spacingScalePx = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160] as const;
