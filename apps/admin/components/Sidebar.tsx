'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@lulwah/ui';
import { useAdminUiStore } from '../lib/stores/ui-store';

/** plan.md §11.1's screen list, in order. */
const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' },
  { href: '/products', label: 'Products' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/discounts', label: 'Discounts' },
  { href: '/customers', label: 'Customers' },
  { href: '/content', label: 'Content' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
  { href: '/users', label: 'Users' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * plan.md §11.2: "Dense, fast, keyboard-driven." A plain vertical list of
 * text links — no icon set, no decoration — collapsible to a narrow rail
 * via `useAdminUiStore` so the order list/detail screens (§11.2 rule 7,
 * "must work on a phone") have more width to work with.
 */
export function Sidebar() {
  const pathname = usePathname();
  const isCollapsed = useAdminUiStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useAdminUiStore((state) => state.toggleSidebar);

  return (
    <aside
      className={cx(
        'flex h-full flex-col border-r border-line bg-nacre transition-[width] duration-base ease-out',
        isCollapsed ? 'w-[56px]' : 'w-[220px]',
      )}
    >
      <div className="flex h-[52px] items-center justify-between border-b border-line px-16">
        {!isCollapsed && <span className="text-label font-semibold uppercase tracking-label text-zamurrad">Lulwah</span>}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="text-body-sm text-ink-70 hover:text-ink"
        >
          {isCollapsed ? '»' : '«'}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-8" aria-label="Admin sections">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                'flex h-[40px] items-center border-l-2 px-16 text-body-sm transition-colors duration-fast ease-out',
                active
                  ? 'border-zamurrad bg-paper font-semibold text-zamurrad'
                  : 'border-transparent text-ink-70 hover:bg-paper hover:text-ink',
              )}
              title={item.label}
            >
              {isCollapsed ? item.label.slice(0, 1) : item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
