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
  // `../../packages/ui/src` is not optional — see the identical fix and
  // its full explanation in `apps/admin/tailwind.config.ts`. Same root
  // cause, same fix, both apps: `@lulwah/ui`'s own Tailwind classes never
  // got generated here either, since Tailwind v4's JIT scanner only
  // generates CSS for a class it can find as a literal string somewhere
  // in `content`, and this package was never in it.
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
} satisfies Config;
