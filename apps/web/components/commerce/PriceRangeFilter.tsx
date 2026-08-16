'use client';

import { useState } from 'react';
import { parseAsInteger, useQueryStates } from 'nuqs';
import { Button } from '@lulwah/ui';

/**
 * plan.md §15.3: "Price (histogram slider)". A histogram needs a real
 * bucketed price-distribution query the search index would compute
 * (§7.14) — not available against a 9-item placeholder catalogue, so this
 * renders a plain min/max range instead (documented simplification). The
 * URL is still the source of truth (`priceMin`/`priceMax`, §12.3, via
 * `nuqs`), just without the histogram bars.
 */
export interface PriceRangeFilterProps {
  minFils: number;
  maxFils: number;
}

export function PriceRangeFilter({ minFils, maxFils }: PriceRangeFilterProps) {
  const [{ priceMin, priceMax }, setPrice] = useQueryStates({
    priceMin: parseAsInteger,
    priceMax: parseAsInteger,
  });
  const [localMin, setLocalMin] = useState(String(priceMin ?? Math.floor(minFils / 100)));
  const [localMax, setLocalMax] = useState(String(priceMax ?? Math.ceil(maxFils / 100)));

  function applyRange() {
    const parsedMin = Number.parseInt(localMin, 10);
    const parsedMax = Number.parseInt(localMax, 10);
    void setPrice({
      priceMin: Number.isFinite(parsedMin) ? parsedMin : null,
      priceMax: Number.isFinite(parsedMax) ? parsedMax : null,
    });
  }

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center gap-8">
        <label className="flex flex-1 flex-col gap-4">
          <span className="font-body text-body-sm text-mukaish">Min (AED)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={localMin}
            onChange={(event) => setLocalMin(event.target.value)}
            className="w-full border-0 border-b border-ink-20 bg-nacre px-8 py-8 font-body text-body-sm text-ink tabular-nums outline-none focus:border-b-2 focus:border-zamurrad"
          />
        </label>
        <label className="flex flex-1 flex-col gap-4">
          <span className="font-body text-body-sm text-mukaish">Max (AED)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={localMax}
            onChange={(event) => setLocalMax(event.target.value)}
            className="w-full border-0 border-b border-ink-20 bg-nacre px-8 py-8 font-body text-body-sm text-ink tabular-nums outline-none focus:border-b-2 focus:border-zamurrad"
          />
        </label>
      </div>
      <Button type="button" variant="secondary" onClick={applyRange} className="w-full">
        Apply
      </Button>
    </div>
  );
}
