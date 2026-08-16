'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cx } from '@lulwah/ui';

/**
 * plan.md §15.4 media column: "vertical thumbnail strip on desktop;
 * swipeable gallery with dot indicators on mobile." A single responsive
 * layout handles both — the thumbnail strip becomes a horizontal
 * scroller under the main image on small screens rather than a separate
 * swipe/dot-indicator implementation.
 *
 * Deviation: the full-screen pinch/scroll-zoom lightbox (§15.4) and 360°
 * spin (§3.2 item 12) aren't built — out of scope for this skeleton.
 */
export interface ProductGalleryImage {
  src: string;
  alt: string;
}

export interface ProductGalleryProps {
  images: ProductGalleryImage[];
  productTitle: string;
}

export function ProductGallery({ images, productTitle }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  return (
    <div className="flex flex-col-reverse gap-16 lg:flex-row">
      {images.length > 1 ? (
        <div className="flex gap-8 overflow-x-auto lg:w-96 lg:shrink-0 lg:flex-col">
          {images.map((image, index) => (
            <button
              key={image.src}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`View image ${index + 1} of ${productTitle}`}
              aria-current={index === activeIndex}
              className={cx(
                'relative aspect-[3/4] w-64 shrink-0 overflow-hidden bg-pearl lg:w-full',
                index === activeIndex && 'outline outline-2 -outline-offset-2 outline-zamurrad',
              )}
            >
              <Image src={image.src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
      <div className="relative aspect-[3/4] flex-1 overflow-hidden bg-pearl">
        {active ? (
          <Image
            src={active.src}
            alt={active.alt}
            fill
            priority
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="object-cover"
          />
        ) : null}
      </div>
    </div>
  );
}
