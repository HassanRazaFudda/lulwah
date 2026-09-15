import Image from 'next/image';
import { cx } from '@lulwah/ui';
import { Link } from '@/i18n/navigation';
import { computeDiscountPercent, DISCOUNT_BADGE_MIN_PERCENT, PriceBlock } from './PriceBlock';
import { WishlistButton } from './WishlistButton';

/**
 * ProductCard — plan.md §13.6's component spec, used on the home rails,
 * every PLP grid, and "You may also like". A Server Component: the only
 * interactive piece is the wishlist heart, split out into its own client
 * component (`WishlistButton`) so this one doesn't need `'use client'` —
 * the hover reveal and size-chip fade are plain CSS (`group-hover:`), no
 * JS required (§12.3: "'use client' only where interaction demands it").
 *
 * Two `Link`s (image region, text region) rather than one wrapping
 * everything — `WishlistButton` renders a real `<button>`, and a `<button>`
 * nested inside an `<a>` is invalid HTML / breaks assistive tech, so the
 * wishlist control has to sit as a sibling of the image `Link`, not a
 * descendant of it.
 */

export interface ProductCardColor {
  name: string;
  hex: string;
}

export interface ProductCardImage {
  src: string;
  alt: string;
}

export interface ProductCardProps {
  slug: string;
  /** Real Mongo product id — required by the wishlist API (`WishlistButton`), which is keyed by `productId`, not `slug`. */
  productId: string;
  title: string;
  image: ProductCardImage;
  /** Revealed on hover via a diagonal clip-path wipe — §13.6, §14.4. Optional: cards with only one shot just skip the hover state. */
  // `| undefined` explicit here and on `compareAtPriceFils` below —
  // `toProductCardProps` (lib/placeholder-data.ts) builds this object from
  // array-destructured/optional source fields whose static type already
  // includes `undefined`; `exactOptionalPropertyTypes` needs the prop's
  // declared type to say so too, not just the `?`.
  hoverImage?: ProductCardImage | undefined;
  priceFils: number;
  compareAtPriceFils?: number | null | undefined;
  /** Up to 4 shown as dots; the rest collapse into a "+N" label — §13.6. */
  colors?: ProductCardColor[];
  /** Pret sizes only (§2.1) — fades up over the image on desktop hover, §13.6. */
  availableSizes?: string[];
  locale: 'en' | 'ar';
  className?: string;
}

const MAX_VISIBLE_COLORS = 4;

export function ProductCard({
  slug,
  productId,
  title,
  image,
  hoverImage,
  priceFils,
  compareAtPriceFils,
  colors = [],
  availableSizes = [],
  locale,
  className,
}: ProductCardProps) {
  const href = `/product/${slug}`;
  const discountPercent = computeDiscountPercent(compareAtPriceFils, priceFils);
  const showDiscountBadge = discountPercent >= DISCOUNT_BADGE_MIN_PERCENT;
  const visibleColors = colors.slice(0, MAX_VISIBLE_COLORS);
  const hiddenColorCount = colors.length - visibleColors.length;

  return (
    <div className={cx('group relative flex flex-col gap-12', className)}>
      {/* Media — 3:4, radius 0, no shadow/border (§13.5, §13.6). */}
      <div className="relative aspect-[3/4] overflow-hidden bg-pearl">
        <Link href={href} aria-label={title} className="absolute inset-0 block">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 33vw, 50vw"
            className={cx(
              'object-cover transition-transform ease-cloth',
              // §14.2 locks four duration tokens; §14.4's prose figure of
              // "420ms" for this exact interaction doesn't match any of
              // them, so — same reconciliation @lulwah/ui's Button makes
              // for its own hover fill — this uses the nearest locked
              // token (`slow`, 480ms) instead of an ad-hoc value.
              'duration-slow group-hover:scale-[1.03]',
            )}
          />
          {hoverImage ? (
            <Image
              src={hoverImage.src}
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 1024px) 33vw, 50vw"
              className={cx(
                'absolute inset-0 object-cover transition-[clip-path,transform] duration-slow ease-cloth',
                'group-hover:scale-[1.03]',
                // Diagonal clip-path wipe — "like a dupatta being lifted"
                // (§14.4). Collapsed to a zero-area point at the top
                // trailing-edge corner at rest, expands to the full
                // rectangle on hover; the resting corner flips under RTL
                // per §16 ("X-axis animations flip sign in RTL").
                '[clip-path:polygon(100%_0%,100%_0%,100%_0%,100%_0%)]',
                'rtl:[clip-path:polygon(0%_0%,0%_0%,0%_0%,0%_0%)]',
                'group-hover:[clip-path:polygon(0%_0%,100%_0%,100%_100%,0%_100%)]',
              )}
            />
          ) : null}
        </Link>

        {showDiscountBadge ? (
          <span
            className={cx(
              'pointer-events-none absolute start-8 top-8 bg-paper px-8 py-4',
              'font-body text-label font-semibold tracking-label text-garnet uppercase',
            )}
          >
            -{discountPercent}%
          </span>
        ) : null}

        <WishlistButton productId={productId} productTitle={title} className="absolute end-4 top-4" />

        {availableSizes.length > 0 ? (
          <div
            className={cx(
              'pointer-events-none absolute inset-x-0 bottom-0 hidden justify-center gap-8 p-8 md:flex',
              'translate-y-8 opacity-0 transition-all duration-base ease-out',
              'md:group-hover:translate-y-0 md:group-hover:opacity-100',
            )}
          >
            {availableSizes.map((size) => (
              <span
                key={size}
                className="bg-paper px-8 py-[2px] font-body text-label font-semibold tracking-label text-ink uppercase"
              >
                {size}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Info */}
      <Link href={href} className="flex flex-col gap-4">
        <h3 className="truncate font-body text-body font-medium text-ink">{title}</h3>
        <PriceBlock priceFils={priceFils} compareAtPriceFils={compareAtPriceFils} locale={locale} />
      </Link>

      {visibleColors.length > 0 ? (
        <div className="flex items-center gap-8">
          {visibleColors.map((color) => (
            <span
              key={color.name}
              title={color.name}
              aria-label={color.name}
              className="size-12 rounded-full border border-line"
              style={{ backgroundColor: color.hex }}
            />
          ))}
          {hiddenColorCount > 0 ? (
            <span className="font-body text-body-sm text-mukaish">+{hiddenColorCount}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
