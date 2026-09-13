'use client';

import { Star } from 'lucide-react';
import { cx } from '@lulwah/ui';

/**
 * Star rating — read-only display (review cards, the summary average) or an
 * interactive 1–5 picker (the write-review form) depending on whether
 * `onChange` is passed. Same gold-fill vocabulary `WishlistButton` already
 * establishes for a filled vs. outline state (`fill-gold text-gold-dark` /
 * `fill-transparent`), so a review card's stars read as the same visual
 * language as the wishlist heart rather than inventing a new fill colour.
 */
export interface ReviewStarsProps {
  /** 1–5; may be fractional for a read-only average (rounded to the nearest whole star for the fill). */
  rating: number;
  size?: number;
  onChange?: (rating: number) => void;
  className?: string;
  label?: string;
}

export function ReviewStars({ rating, size = 16, onChange, className, label }: ReviewStarsProps) {
  const rounded = Math.round(rating);
  const stars = [1, 2, 3, 4, 5] as const;

  if (!onChange) {
    return (
      <span
        role="img"
        aria-label={label ?? `${rating.toFixed(1)} out of 5 stars`}
        className={cx('inline-flex items-center gap-2', className)}
      >
        {stars.map((value) => (
          <Star
            key={value}
            size={size}
            strokeWidth={1.5}
            aria-hidden="true"
            className={value <= rounded ? 'fill-gold text-gold-dark' : 'fill-transparent text-ink-20'}
          />
        ))}
      </span>
    );
  }

  return (
    <span role="radiogroup" aria-label={label ?? 'Rating'} className={cx('inline-flex items-center gap-4', className)}>
      {stars.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={value === rounded}
          aria-label={`${value} star${value === 1 ? '' : 's'}`}
          onClick={() => onChange(value)}
          className="p-2 transition-transform duration-fast ease-out active:scale-90"
        >
          <Star
            size={size}
            strokeWidth={1.5}
            aria-hidden="true"
            className={value <= rounded ? 'fill-gold text-gold-dark' : 'fill-transparent text-ink-20'}
          />
        </button>
      ))}
    </span>
  );
}
