'use client';

import { useEffect, useRef, useState } from 'react';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cx } from '@lulwah/ui';
import { Link, usePathname } from '@/i18n/navigation';
import { LulwahMonogram } from './LulwahMonogram';

// Deviation: plan.md's full mega-menu (four link columns plus a
// crossfading featured tile, §15.1) is not built here — it's a
// substantial motion-heavy component of its own that neither this file's
// required-component list nor the "out of scope" GSAP/motion note asks
// for. The primary nav below links directly to the same three
// core-navigation destinations the mega menu would headline (§15.2 item
// 3's "store's core navigation idea"), so the chrome is complete and
// functional; the elaborated panel is left as a follow-up.
//
// No "Brands" entry — removed along with the rest of the storefront's
// "Brands We Carry" marketing surface (the home page's brand marquee,
// `/brands` + `/brands/[slug]`, the footer link): Lulwah Fashion sells
// its own product, it isn't a multi-brand retailer, so a nav item
// inviting a shopper to browse "brands" no longer describes anything
// real. See `docs/adr/0001-remove-brand-listing.md`.
const NAV_LINKS = [
  { href: '/shop/unstitched', labelKey: 'unstitched' },
  { href: '/shop/pret', labelKey: 'readyToWear' },
  { href: '/shop/formal-wedding', labelKey: 'formalWedding' },
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
 * way) so this header's own resting offset stays correct either way.
 *
 * Position is one computed `transform: translateY()` (`translateYPx`
 * below), not a `top-32`/`top-0` class pair plus a separate `-translate-
 * y-full` for the hide state — found live, reported by the user: with
 * `top` doing the announcement-offset and a *fixed* `-translate-y-full`
 * (100% of this header's own height) doing the hide, hiding while the
 * announcement bar was still visible only ever moved this header up by
 * its own height, not by its own height *plus* the 32px `top` offset it
 * was already resting at — so scrolling down while the bar was still up
 * left exactly that 32px sliver of the header's own bottom edge stuck in
 * the viewport, overlapping the announcement bar's own space. Computing
 * one translateY that folds in both the resting offset and the hide
 * distance fixes that at the source, and also drops `top` from the
 * animated properties below — `transform` alone is the compositor-
 * friendly one.
 */
const HEADER_HEIGHT_PX = 64; // must match `h-64` below.
const ANNOUNCEMENT_HEIGHT_PX = 32; // must match `AnnouncementBar.tsx`'s own `h-32`.
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

  const restingOffsetPx = isAnnouncementVisible ? ANNOUNCEMENT_HEIGHT_PX : 0;
  const translateYPx = isHidden ? -(HEADER_HEIGHT_PX + restingOffsetPx) : restingOffsetPx;

  return (
    <header
      style={{ transform: `translateY(${translateYPx}px)` }}
      className={cx(
        'fixed inset-x-0 top-0 z-40 border-b transition-[background-color,color,border-color,transform] duration-base ease-out',
        isTransparent ? 'border-transparent bg-transparent text-paper' : 'border-gold bg-paper text-ink',
      )}
    >
      {isTransparent ? (
        // Found live, reported by the user: the gold logo and the
        // permanently-garnet "Sale" link (§13.3's "garnet marks sale
        // links, unconditionally" rule — it doesn't switch to `text-paper`
        // with the rest of the nav) both went unreadable over lighter
        // patches of the Hero photo. A scrim guarantees contrast for both
        // regardless of what's directly behind them, without touching
        // Hero.tsx or making Sale's colour conditional on scroll state.
        //
        // `h-160`, not `inset-0` (still reported unreadable after the
        // first attempt) — `inset-0` sized the scrim to exactly this
        // header's own 64px box, so `bg-gradient-to-b`'s 50% stop (where
        // the fade is already most of the way to transparent) landed
        // almost exactly on the vertically-centred logo/nav row, leaving
        // real content sitting in the *weakest* part of the gradient
        // instead of the strongest. A scrim taller than the header itself
        // — overflowing past its bottom edge into the Hero below, which
        // `header` never clips since nothing here sets `overflow-hidden`
        // — keeps the whole header's content inside the gradient's dark,
        // high-opacity top portion, fading out gracefully into the Hero
        // beneath rather than inside the header's own content row.
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-160 bg-gradient-to-b from-ink/65 via-ink/40 to-transparent"
        />
      ) : null}
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
          className={cx(
            'absolute start-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-12',
            isTransparent ? 'text-paper' : 'text-plum',
          )}
        >
          <LulwahMonogram className="h-[38px] w-auto shrink-0" />
          {/* No `items-center` here — flex's own default (`stretch`) is what
              does the real work: both rows below stretch to the width of
              whichever is naturally widest ("Lulwah", the larger of the two
              type sizes), so the "— Fashion —" row is automatically exactly
              as wide as "Lulwah" above it, matching the source lockup's own
              proportions, rather than two arbitrarily-guessed pixel widths
              that happened to look right at one size and wrong at another. */}
          <span className="flex flex-col leading-none">
            <span className="font-display text-center text-[21px] tracking-display uppercase">Lulwah</span>
            {/* Flanking hairlines either side of "Fashion" — the source
                logo (LULWAH.pdf/.ai) draws these as two thin rules bracketing
                a notably smaller "FASHION" than "LULWAH" above it, not
                tracked type on its own. `flex-1` on each hairline (not a
                fixed width) is what makes the whole row fill exactly to
                `LULWAH`'s own width regardless of how small the text
                itself is — a smaller "Fashion" here means longer hairlines
                automatically, not a separate width to tune by hand.
                `gap-4`, not `gap-6` — found live, reported by the user: this
                project's spacing scale is a locked, replaced set (packages/
                tokens/src/spacing.ts), not Tailwind's default one, and "6"
                isn't one of its steps, so `gap-6` generated no CSS at all —
                the exact same silent-failure class of bug §8.1 already
                documents for `-0` utilities.
                `me-[-0.16em]` on "Fashion" (matching `tracking-label`'s own
                0.16em) — found live, reported by the user via DevTools'
                own box-model overlay: `letter-spacing` adds space after
                *every* character it tracks, including the last one, so the
                gap to the closing hairline reads visibly wider than the gap
                from the opening one even with the same `gap` on both sides.
                This cancels exactly that trailing addition, in `em` so it
                keeps tracking the text's own font-size if that ever changes,
                rather than a fixed px guess. */}
            <span className="mt-4 flex items-center gap-4">
              <span aria-hidden="true" className="h-[1px] flex-1 bg-current" />
              <span className="font-body text-[10px] font-semibold tracking-label uppercase">Fashion</span>
              <span aria-hidden="true" className="h-[1px] flex-1 bg-current" />
            </span>
          </span>
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
