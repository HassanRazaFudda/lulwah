import type { Config } from 'tailwindcss';
import preset from '@lulwah/config/tailwind-preset';

/**
 * Wires in `@lulwah/config`'s locked design-token preset exactly as its
 * own doc comment prescribes (packages/config/tailwind-preset.ts) — this
 * is what replaces Tailwind's default palette/spacing/radius/easing
 * (plan.md §13.2's banned list: no `gray-500`, no `rounded-2xl`). Loaded
 * into the v4 build via the `@config` directive in `styles/globals.css`.
 */
export default {
  presets: [preset],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
} satisfies Config;
