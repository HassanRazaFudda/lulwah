'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cx } from '@lulwah/ui';
import { Link, usePathname } from '@/i18n/navigation';

// Client-provided mark (logo.png at the repo root) extracted onto a
// transparent background in two colorways: gold for the transparent
// header state over the dark hero, ink for the solid-paper state
// elsewhere (plan.md §15.1). Native aspect ratio preserved (731:640)
// so next/image never has to guess and shift layout. Both files already
// existed in `public/brand/` untouched by this fix -- only the ink one
// was ever actually referenced before now.
const LOGO_ASPECT = 731 / 640;
const LOGO_HEIGHT = 40;
const LOGO_SRC = {
  gold: '/brand/logo-lockup-gold.png',
  ink: '/brand/logo-lockup-ink.png',
} as const;

// Deviation: plan.md's full mega-menu (four link columns plus a
// crossfading featured tile, §15.1) is not built here — it's a
// substantial motion-heavy component of its own that neither this file's
// required-component list nor the "out of scope" GSAP/motion note asks
// for. The primary nav below links directly to the same three
// core-navigation destinations the mega menu would headline (§15.2 item
// 3's "store's core navigation idea"), so the chrome is complete and
// functional; the elaborated panel is left as a follow-up.
const NAV_LINKS = [
  { href: '/shop/unstitched', labelKey: 'unstitched' },
  { href: '/shop/pret', labelKey: 'readyToWear' },
  { href: '/shop/formal-wedding', labelKey: 'formalWedding' },
  { href: '/brands', labelKey: 'brands' },
  { href: '/shop/sale', labelKey: 'sale' },
] as const;

const HIDE_AFTER_PX = 160;

// plan.md §15.1: the header becomes solid past this scroll depth on the
// homepage (it's solid immediately, from 0, on every other route).
const SOLID_AFTER_PX = 80;

// Must match `AnnouncementBar.tsx`'s own `SESSION_KEY` exactly.
const ANNOUNCEMENT_DISMISSED_KEY = 'lulwah-announcement-dismissed';

/**
 * plan.md §15.1: transparent over the homepage hero, solid `paper`
 * elsewhere; becomes solid on scroll past 80px with a gold hairline
 * underneath; hides on scroll down, reappears on scroll up. Layout:
 * primary nav (start) / centred wordmark / search-account-cart (end);
 * mobile collapses to a hamburger + centred wordmark + cart.
 *
 * This is the "proper fix" the header's previous always-solid version
 * (implemented-plan.md §8.4) deferred: the header is `fixed`, not
 * `sticky`, so it's removed from document flow entirely and the
 * homepage's Hero (the one deliberate exception — see `MainContent.tsx`)
 * can render flush from the very top of the page, genuinely *behind* the
 * transparent header, rather than starting only after it in flow (the
 * literal cause of §8.4's bug — a `sticky` header only ever sat in front
 * of the plain page background, never the hero). Every other route's
 * content gets compensating top padding for exactly the flow space this
 * header and the announcement bar above it no longer occupy — see
 * `MainContent.tsx`, which also owns the real px values (`h-64` here,
 * `AnnouncementBar`'s own rendered height) this file's own `top-32`/
 * `top-0` below re-derive independently for its own positioning; kept as
 * plain Tailwind literals rather than a shared constants module, since
 * both are small, stable, and each file already needs its own literal
 * class strings for Tailwind's static build-time scan to find.
 *
 * The announcement bar above this header is, like this header, now
 * `fixed` rather than in normal flow (see `AnnouncementBar.tsx`'s own
 * comment) — leaving it in flow while only this header went `fixed`
 * would have let this header's fixed position permanently outrun the
 * bar's in-flow one as soon as the page scrolled past the bar's own
 * height, exposing a gap of un-covered page content between the top of
 * the viewport and this header. `isAnnouncementVisible` tracks whether
 * that bar is still on screen (re-checked on every scroll tick, since
 * this header lives in the persistent locale layout and never remounts
 * on client-side navigation to notice a same-session dismissal any other
 * way) so this header's own `top` offset stays correct either way.
 */
export function Header() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  const [isHidden, setIsHidden] = useState(false);
  const [isPastSolidThreshold, setIsPastSolidThreshold] = useState(false);
  const [isAnnouncementVisible, setIsAnnouncementVisible] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function syncAnnouncementVisibility() {
      setIsAnnouncementVisible(sessionStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY) !== '1');
    }
    syncAnnouncementVisibility();

    function onScroll() {
      const y = window.scrollY;
      setIsHidden(y > lastScrollY.current && y > HIDE_AFTER_PX);
      setIsPastSolidThreshold(y > SOLID_AFTER_PX);
      lastScrollY.current = y;
      syncAnnouncementVisibility();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // plan.md §15.1: transparent only on the homepage, before the 80px
  // scroll threshold; solid (paper bg, gold hairline) everywhere else,
  // including on the homepage itself once scrolled past it.
  const isTransparent = isHomePage && !isPastSolidThreshold;

  return (
    <header
      className={cx(
        'fixed inset-x-0 z-40 border-b transition-[background-color,color,border-color,top,transform] duration-base ease-out',
        isAnnouncementVisible ? 'top-32' : 'top-0',
        isHidden ? '-translate-y-full' : 'translate-y-0',
        isTransparent ? 'border-transparent bg-transparent text-paper' : 'border-gold bg-paper text-ink',
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
          aria-label="Lulwah Fashion"
          className="absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <Image
            src={isTransparent ? LOGO_SRC.gold : LOGO_SRC.ink}
            alt="Lulwah Fashion"
            width={Math.round(LOGO_HEIGHT * LOGO_ASPECT)}
            height={LOGO_HEIGHT}
            priority
            className="h-[40px] w-auto"
          />
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
