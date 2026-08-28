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
  // `../../packages/ui/src` is not optional — `@lulwah/ui`'s `Input`/
  // `Button` ship their own Tailwind classes (the floating-label
  // positioning, hover/focus variants, ...) baked into their `className`
  // strings, and Tailwind v4's JIT scanner only ever generates CSS for a
  // utility class it can find, as a literal string, somewhere inside
  // `content`. Omitting the package that actually contains those strings
  // doesn't error or warn — it just silently never generates that CSS,
  // so the component renders with only whichever of its classes happen
  // to *also* appear, coincidentally, in this app's own source. Found
  // live: `Input`'s floating label rendered as a plain unstyled `<label>`
  // sitting outside the field entirely (no `absolute` positioning, no
  // `peer-focus`/`peer-[:not(:placeholder-shown)]` shrink-to-top-corner
  // behavior — none of the CSS that pattern depends on had ever been
  // generated), while `Button` happened to look fine only because
  // several of its own classes (`bg-zamurrad`, `h-[52px]`, `rounded-sm`,
  // ...) are common enough that other admin-authored components already
  // used them elsewhere, generating the CSS by accident. This was never
  // caught earlier because no verification pass this build ever visually
  // rendered a page — every check was typecheck/lint/test/build, none of
  // which can catch "this class exists in the source but never made it
  // into the stylesheet."
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
} satisfies Config;
