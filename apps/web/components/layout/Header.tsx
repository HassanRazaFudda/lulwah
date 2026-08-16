'use client';

import { useEffect, useRef, useState } from 'react';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cx } from '@lulwah/ui';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * plan.md §15.1: transparent over the homepage hero, solid `paper`
 * elsewhere; becomes solid past an 80px scroll with a gold hairline
 * underneath; hides on scroll down, reappears on scroll up. Layout:
 * primary nav (start) / centred wordmark / search-account-cart (end);
 * mobile collapses to a hamburger + centred wordmark + cart.
 *
 * Deviation: plan.md's full mega-menu (four link columns plus a
 * crossfading featured tile, §15.1) is not built here — it's a
 * substantial motion-heavy component of its own that neither this file's
 * required-component list nor the "out of scope" GSAP/motion note asks
 * for. The primary nav below links directly to the same three
 * core-navigation destinations the mega menu would headline (§15.2 item
 * 3's "store's core navigation idea"), so the chrome is complete and
 * functional; the elaborated panel is left as a follow-up.
 */
const NAV_LINKS = [
  { href: '/shop/unstitched', labelKey: 'unstitched' },
  { href: '/shop/pret', labelKey: 'readyToWear' },
  { href: '/shop/formal-wedding', labelKey: 'formalWedding' },
  { href: '/brands', labelKey: 'brands' },
  { href: '/shop/sale', labelKey: 'sale' },
] as const;

const SOLID_AFTER_PX = 80;
const HIDE_AFTER_PX = 160;

export function Header() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const isHome = pathname === '/';

  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setIsScrolled(y > SOLID_AFTER_PX);
      setIsHidden(y > lastScrollY.current && y > HIDE_AFTER_PX);
      lastScrollY.current = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isTransparent = isHome && !isScrolled && !isMobileNavOpen;

  return (
    <header
      className={cx(
        'sticky top-0 z-40 transition-transform duration-base ease-out',
        isHidden ? '-translate-y-full' : 'translate-y-0',
        isTransparent ? 'bg-transparent text-paper' : 'border-b border-line bg-paper text-ink',
      )}
    >
      <div className="relative mx-auto flex h-64 max-w-[1600px] items-center justify-between px-24 lg:px-[clamp(24px,5vw,88px)]">
        <button
          type="button"
          className="inline-flex items-center gap-8 lg:hidden"
          onClick={() => setIsMobileNavOpen((open) => !open)}
          aria-expanded={isMobileNavOpen}
          aria-label={t('menu')}
        >
          {isMobileNavOpen ? (
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Menu size={20} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>

        <nav aria-label={t('primary')} className="hidden items-center gap-24 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cx(
                'font-body text-label font-semibold tracking-label uppercase transition-colors duration-base ease-out hover:text-gold-dark',
                link.labelKey === 'sale' && 'text-garnet',
              )}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>

        <Link
          href="/"
          className="absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-heading-1 tracking-display"
        >
          Lulwah
        </Link>

        <div className="flex items-center gap-16">
          <Link href="/search" aria-label={t('search')} className="hidden lg:inline-flex">
            <Search size={20} strokeWidth={1.5} aria-hidden="true" />
          </Link>
          <Link href="/account/orders" aria-label={t('account')} className="hidden lg:inline-flex">
            <User size={20} strokeWidth={1.5} aria-hidden="true" />
          </Link>
          <Link href="/cart" aria-label={t('cart')} className="inline-flex">
            <ShoppingBag size={20} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {isMobileNavOpen ? (
        <nav
          aria-label={t('primary')}
          className="flex flex-col gap-24 border-t border-line bg-paper px-24 py-24 text-ink lg:hidden"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileNavOpen(false)}
              className={cx(
                'font-body text-label font-semibold tracking-label uppercase',
                link.labelKey === 'sale' && 'text-garnet',
              )}
            >
              {t(link.labelKey)}
            </Link>
          ))}
          <Link href="/search" onClick={() => setIsMobileNavOpen(false)} className="font-body text-body">
            {t('search')}
          </Link>
          <Link href="/account/orders" onClick={() => setIsMobileNavOpen(false)} className="font-body text-body">
            {t('account')}
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
