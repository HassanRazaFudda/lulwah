'use client';

import { useRef, useState, type UIEvent } from 'react';
import { cx } from '@lulwah/ui';
import { Link } from '@/i18n/navigation';
import { ProductCard, type ProductCardProps } from '@/components/commerce/ProductCard';

/**
 * plan.md §15.2 item 2, "New arrivals rail": horizontal scroll, ~3.4 cards
 * visible on desktop, drag/swipe, hairline progress bar. The scroller
 * itself is native CSS scroll-snap (free drag/swipe on touch and trackpad,
 * no JS); a client component only because the hairline progress bar needs
 * live `scrollLeft` to draw itself.
 */
export interface CollectionRailProps {
  title: string;
  viewAllHref: string;
  viewAllLabel: string;
  items: ProductCardProps[];
}

export function CollectionRail({ title, viewAllHref, viewAllLabel, items }: CollectionRailProps) {
  const [progress, setProgress] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? el.scrollLeft / max : 0);
  }

  return (
    <section className="flex flex-col gap-24 px-24 lg:px-[clamp(24px,5vw,88px)]">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-heading-1 tracking-display text-ink">{title}</h2>
        <Link
          href={viewAllHref}
          className="font-body text-body text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
        >
          {viewAllLabel}
        </Link>
      </div>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        className={cx(
          'flex snap-x snap-mandatory gap-16 overflow-x-auto pb-8',
          '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {items.map((item) => (
          <ProductCard key={item.slug} {...item} className="w-[72vw] shrink-0 snap-start sm:w-[42vw] lg:w-[29%]" />
        ))}
      </div>

      <div className="h-px w-full bg-line" aria-hidden="true">
        <div
          className="h-px bg-gold-dark transition-[width] duration-fast ease-out"
          style={{ width: `${Math.max(progress * 100, items.length > 0 ? 100 / items.length : 0)}%` }}
        />
      </div>
    </section>
  );
}
