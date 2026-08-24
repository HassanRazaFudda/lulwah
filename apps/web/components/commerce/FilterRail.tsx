import { cx } from '@lulwah/ui';
import { Link } from '@/i18n/navigation';
import { PriceRangeFilter } from './PriceRangeFilter';

/**
 * PLP filter rail — plan.md §15.3: "desktop: sticky left column, always
 * visible, no accordion-hell... Every facet shows counts." A purely
 * presentational Server Component: `app/[locale]/(shop)/shop/[...category]/page.tsx`
 * computes each option's toggle `href` (current query string with that
 * value added/removed) server-side, so every checkbox here is a real,
 * crawlable link — filtering works with JavaScript disabled, consistent
 * with §12.2's ISR-first rendering strategy. Only the Price range and the
 * "Load more" button need client JS (see `PriceRangeFilter`).
 *
 * Deviation: plan.md's mobile "bottom sheet with a live 'Show N results'
 * button" isn't built — the rail renders inline above the grid on mobile
 * instead, same content, no drawer chrome.
 */
export interface FilterOptionView {
  value: string;
  label: string;
  count: number;
  href: string;
  isSelected: boolean;
}

export interface FilterGroupView {
  key: string;
  label: string;
  options: FilterOptionView[];
}

export interface FilterRailProps {
  groups: FilterGroupView[];
  priceRangeFils: { minFils: number; maxFils: number };
  clearHref: string;
  hasActiveFilters: boolean;
}

/** Price renders between "Size" and "Availability" per the locked facet order (§15.3). */
const PRICE_AFTER_GROUP_KEY = 'size';

export function FilterRail({ groups, priceRangeFils, clearHref, hasActiveFilters }: FilterRailProps) {
  return (
    <aside className="flex w-full flex-col gap-24 lg:sticky lg:top-96 lg:w-[240px] lg:shrink-0 lg:self-start">
      <div className="flex items-center justify-between">
        <h2 className="font-body text-label font-semibold tracking-label text-ink uppercase">Filter</h2>
        {hasActiveFilters ? (
          <Link
            href={clearHref}
            className="font-body text-body-sm text-mukaish underline decoration-1 underline-offset-4 hover:text-ink"
          >
            Clear all
          </Link>
        ) : null}
      </div>

      {groups.map((group) =>
        // The Price range control is anchored right after the Size group
        // (`PRICE_AFTER_GROUP_KEY`) regardless of whether Size itself has
        // any options to show — real product listings don't carry
        // per-product size data (`GET /products` embeds no variants), so
        // Size is routinely empty against the real API. Gating this whole
        // fieldset on `options.length > 0` would silently drop Price too
        // whenever Size is empty; only the size *checkboxes* should
        // disappear in that case, not the price filter riding alongside
        // them (see `FacetFieldset` below).
        group.options.length > 0 || group.key === PRICE_AFTER_GROUP_KEY ? (
          <FacetFieldset key={group.key} group={group} priceRangeFils={priceRangeFils} />
        ) : null,
      )}
    </aside>
  );
}

function FacetFieldset({
  group,
  priceRangeFils,
}: {
  group: FilterGroupView;
  priceRangeFils: { minFils: number; maxFils: number };
}) {
  return (
    <>
      {group.options.length > 0 ? (
        <fieldset className="flex flex-col gap-12 border-t border-line pt-24">
          <legend className="mb-4 font-body text-label font-semibold tracking-label text-ink uppercase">
            {group.label}
          </legend>
          <ul className="flex flex-col gap-8">
            {group.options.map((option) => (
              <li key={option.value}>
                <Link
                  href={option.href}
                  aria-current={option.isSelected ? 'true' : undefined}
                  className="flex items-center justify-between gap-8 font-body text-body-sm text-ink-70 hover:text-ink"
                >
                  <span className="flex items-center gap-8">
                    <span
                      aria-hidden="true"
                      className={cx(
                        'inline-flex size-16 shrink-0 items-center justify-center border',
                        option.isSelected ? 'border-zamurrad bg-zamurrad' : 'border-ink-20 bg-transparent',
                      )}
                    >
                      {option.isSelected ? <span className="size-8 bg-paper" /> : null}
                    </span>
                    {option.label}
                  </span>
                  <span className="tabular-nums text-mukaish">{option.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}
      {group.key === PRICE_AFTER_GROUP_KEY ? (
        <div className="flex flex-col gap-12 border-t border-line pt-24">
          <h3 className="font-body text-label font-semibold tracking-label text-ink uppercase">Price</h3>
          <PriceRangeFilter minFils={priceRangeFils.minFils} maxFils={priceRangeFils.maxFils} />
        </div>
      ) : null}
    </>
  );
}
