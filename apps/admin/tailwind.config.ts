import type { Config } from 'tailwindcss';
import preset from '@lulwah/config/tailwind-preset';

/**
 * The admin console consumes the same locked token preset as the
 * storefront (plan.md §11: "Visually it is a tool: neutral greys, one
 * accent, high information density" — but the underlying palette is still
 * exactly `@lulwah/tokens`, not a second colour system). Admin-specific
 * "neutral grey" surfaces are built from the preset's already-neutral
 * tokens — `paper`, `nacre`, `pearl`, `mukaish`, the `ink-*` alphas — with
 * `zamurrad` as the single accent, rather than inventing a new grey scale.
 */
export default {
  presets: [preset],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
} satisfies Config;
