import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { computeDiscountPercent, PriceBlock } from '../PriceBlock';

describe('computeDiscountPercent', () => {
  // plan.md §8.2: discountPercent = round((compareAt - final) / compareAt * 100)
  it('computes the exact rounded percentage for a straightforward cut', () => {
    // (34900 - 24900) / 34900 * 100 = 28.653... -> rounds to 29
    expect(computeDiscountPercent(34_900, 24_900)).toBe(29);
  });

  it('rounds half-up at the .5 boundary', () => {
    // (200 - 190) / 200 * 100 = 5 exactly
    expect(computeDiscountPercent(200, 190)).toBe(5);
    // (1000 - 875) / 1000 * 100 = 12.5 -> Math.round rounds .5 up to 13
    expect(computeDiscountPercent(1_000, 875)).toBe(13);
  });

  it('returns 0 when there is no compare-at price', () => {
    expect(computeDiscountPercent(null, 24_900)).toBe(0);
    expect(computeDiscountPercent(undefined, 24_900)).toBe(0);
  });

  it('returns 0 rather than negative when compare-at is at or below the selling price', () => {
    expect(computeDiscountPercent(24_900, 24_900)).toBe(0);
    expect(computeDiscountPercent(20_000, 24_900)).toBe(0);
  });

  it('returns 100 for a price cut to zero', () => {
    expect(computeDiscountPercent(10_000, 0)).toBe(100);
  });
});

describe('PriceBlock', () => {
  it('renders only the final price when there is no compare-at price', () => {
    render(<PriceBlock priceFils={24_900} locale="en" />);
    expect(screen.getByText('AED 249.00')).toBeInTheDocument();
    expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
  });

  it('shows the struck-through compare-at price whenever there is a real price cut, regardless of badge threshold', () => {
    // 3% off: below the 5% badge threshold, but the strike-through itself has no threshold.
    render(<PriceBlock priceFils={9_700} compareAtPriceFils={10_000} locale="en" />);
    expect(screen.getByText('AED 97.00')).toBeInTheDocument();
    expect(screen.getByText('AED 100.00')).toBeInTheDocument();
    expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
  });

  it('shows the -N% badge once the discount is exactly at the 5% threshold', () => {
    render(<PriceBlock priceFils={190} compareAtPriceFils={200} locale="en" />);
    expect(screen.getByText('-5%')).toBeInTheDocument();
  });

  it('hides the badge just under the threshold (4%) and shows it just over (6%)', () => {
    const { rerender } = render(<PriceBlock priceFils={9_600} compareAtPriceFils={10_000} locale="en" />);
    // (10000-9600)/10000*100 = 4% -> no badge
    expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();

    rerender(<PriceBlock priceFils={9_400} compareAtPriceFils={10_000} locale="en" />);
    // (10000-9400)/10000*100 = 6% -> badge
    expect(screen.getByText('-6%')).toBeInTheDocument();
  });

  it('never shows a strike-through or badge for a fabricated/non-cut compare-at', () => {
    render(<PriceBlock priceFils={24_900} compareAtPriceFils={24_900} locale="en" />);
    expect(screen.queryByText(/line-through/)).not.toBeInTheDocument();
    expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
  });
});
