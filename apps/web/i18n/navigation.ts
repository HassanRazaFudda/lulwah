import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware `Link`/`useRouter`/`usePathname` — every internal link goes
 * through these so the `/en`/`/ar` prefix is never hand-built (plan.md
 * §16).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
