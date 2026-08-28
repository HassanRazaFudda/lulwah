'use client';

import type { ReactNode } from 'react';
import { cx } from '@lulwah/ui';
import { usePathname } from '@/i18n/navigation';

/**
 * plan.md §15.1 / implemented-plan.md §8.4's "proper fix": `Header.tsx`
 * (and the `AnnouncementBar.tsx` sitting above it) are now `fixed`, not
 * `sticky` — removed from document flow entirely, so the homepage's Hero
 * can render flush from the very top of the page and sit genuinely
 * *behind* the transparent header. Every other route's content needs
 * compensating top padding for exactly the flow space that fixed chrome
 * no longer occupies, or its own content renders underneath it.
 *
 * `pt-96` = the header's real rendered height (`h-64` in `Header.tsx`, no
 * responsive variant) plus the announcement bar's real rendered height
 * (`Header.tsx`'s own `top-32`/`AnnouncementBar.tsx` — `py-8` plus its
 * label-type line height, ≈30px, rounded up to the nearest step in the
 * locked spacing scale). `96` is itself a literal step in that scale
 * (plan.md §13.5), so this is one class, not an arbitrary value.
 *
 * The homepage is the one deliberate exception (plan.md §15.2 item 1):
 * its Hero bleeds all the way up under the transparent header by design,
 * so it gets no compensating padding at all.
 */
export function MainContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  return (
    <main id="main-content" className={cx(!isHomePage && 'pt-96')}>
      {children}
    </main>
  );
}
