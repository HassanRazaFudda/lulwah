import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cx } from './cx.js';

/**
 * Button — plan.md §13.6. Three variants, radius 2px (never a pill), no
 * gradients (§13.2 banned list). Built on Radix's `Slot` primitive for the
 * `asChild` pattern — Radix has no dedicated Button primitive, so this is
 * a styled native `<button>` with Radix's composition behaviour, not a
 * shadcn-style pre-skinned component.
 *
 * Class names below assume `@lulwah/config/tailwind-preset` is active in
 * the consuming app: `zamurrad`, `ink`, `nacre` etc. only exist because
 * that preset replaces Tailwind's default palette (§13.2).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Renders as the single child element instead of a `<button>` (Radix `Slot` pattern) — e.g. wrap a `next/link` `<a>`. */
  asChild?: boolean;
  children: ReactNode;
}

const BASE_CLASSES = cx(
  'inline-flex items-center justify-center gap-8 whitespace-nowrap',
  'font-body text-label font-semibold uppercase tracking-label',
  'transition-colors duration-base ease-out',
  'disabled:cursor-not-allowed disabled:opacity-40',
);

// Hover fill is 240ms in plan.md §13.6's prose but §14.2 locks the motion
// scale to fast/base/slow/cloth with no ad-hoc values — `base` (280ms) is
// the closest token and is what this component uses.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'h-[52px] rounded-sm bg-zamurrad px-24 text-paper hover:bg-zamurrad-deep',
  secondary: 'h-[52px] rounded-sm border border-ink bg-transparent px-24 text-ink hover:bg-ink hover:text-paper',
  tertiary: 'h-auto border-0 bg-transparent p-0 text-ink underline underline-offset-4 hover:decoration-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', asChild = false, className, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cx(BASE_CLASSES, VARIANT_CLASSES[variant], className)} {...props} />;
});
