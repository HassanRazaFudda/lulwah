import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { isExternalHref } from '@/lib/content-mappers';

export interface ContentLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
}

/**
 * CMS-authored hrefs (`HeroSectionSettings.linkHref`,
 * `CollectionRailSectionSettings.viewAllHref`, a `CategoryGridTile.href`,
 * ...) are arbitrary admin-typed strings, unlike every other link in this
 * app so far (always a known internal path) — routing an external URL
 * through next-intl's locale-prefixing `Link` would be wrong, so this picks
 * the right tag per href. Has no server-only dependencies (`Link` from
 * `@/i18n/navigation` is already usable from both Server and Client
 * Components in this codebase — see `CollectionRail.tsx`), so it's safe to
 * import from either.
 */
export function ContentLink({ href, className, children }: ContentLinkProps) {
  if (isExternalHref(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
