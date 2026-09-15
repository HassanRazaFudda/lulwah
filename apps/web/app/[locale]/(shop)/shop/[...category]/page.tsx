import type { Metadata } from 'next';
import { ProductCard } from '@/components/commerce/ProductCard';
import { FilterRail, type FilterGroupView, type FilterOptionView } from '@/components/commerce/FilterRail';
import { LoadMoreButton } from '@/components/commerce/LoadMoreButton';
import type { AppLocale } from '@/i18n/routing';
import { buildFacetGroups, getPriceRange, humanize } from '@/lib/facets';
import type { ProductSort } from '@/lib/catalog-client';
import { toProductCardProps } from '@/lib/product-mappers';
import { loadPlpData, type PlpFacetSelections } from '@/lib/plp-data';
import { resolveShopSegments } from '@/lib/shop-segment';
import type { ColorFamily, Fabric, Occasion, Size, StitchingType, Work } from '@lulwah/contracts';

/**
 * PLP — plan.md §15.3. `[...category]` is a real Next.js catch-all, so
 * every category path in the site (`/shop/unstitched`, `/shop/sale`,
 * `/shop/eid`, `/shop/{collection-slug}`, ...) resolves through this one
 * route. `resolveShopSegments` (`lib/shop-segment.ts`) maps that path to a
 * real category/collection/occasion/sort scope against `GET /products`,
 * replacing the placeholder version's hand-rolled `matchesCategorySegments`
 * switch. State management is unchanged from the placeholder version: a
 * plain Server Component reading `searchParams` and building each facet
 * toggle's `href` server-side (`nuqs` is only used by the two genuinely
 * client-interactive controls, `PriceRangeFilter`/`LoadMoreButton`) — only
 * *where the data comes from* changed.
 */
type SearchParamsRecord = Record<string, string | string[] | undefined>;

function getSelected(searchParams: SearchParamsRecord, key: string): string[] {
  const raw = searchParams[key];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : raw.split(',').filter(Boolean);
}

/** Builds the toggle href for one facet option — current query string with `value` added to/removed from `key`, `page` always reset. */
function buildFacetHref(basePath: string, searchParams: SearchParamsRecord, key: string, value: string): string {
  const params = new URLSearchParams();
  for (const [paramKey, paramValue] of Object.entries(searchParams)) {
    if (paramKey === key || paramKey === 'page' || paramValue === undefined) continue;
    for (const v of Array.isArray(paramValue) ? paramValue : [paramValue]) params.append(paramKey, v);
  }
  const current = getSelected(searchParams, key);
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  if (next.length > 0) params.set(key, next.join(','));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function buildFacetGroupViews(
  groups: ReturnType<typeof buildFacetGroups>,
  basePath: string,
  searchParams: SearchParamsRecord,
): FilterGroupView[] {
  return groups.map((group) => {
    const key = group.key;
    const selected = key === 'sale' ? (searchParams.sale === '1' ? ['1'] : []) : getSelected(searchParams, key);
    const options: FilterOptionView[] = group.options.map((option) => ({
      ...option,
      href:
        key === 'sale'
          ? buildFacetHref(basePath, searchParams, 'sale', '1')
          : buildFacetHref(basePath, searchParams, key, option.value),
      isSelected: selected.includes(option.value),
    }));
    return { key: group.key, label: group.label, options };
  });
}

interface PlpPageProps {
  params: Promise<{ locale: AppLocale; category?: string[] }>;
  searchParams: Promise<SearchParamsRecord>;
}

export async function generateMetadata({ params }: PlpPageProps): Promise<Metadata> {
  const { category = [] } = await params;
  const heading = category.length > 0 ? category.map(humanize).join(' / ') : 'Shop All';
  return {
    title: `${heading} in the UAE`,
    description: `Shop ${heading} from Pakistan's leading designer houses, delivered across the UAE in 2–4 days.`,
  };
}

export default async function ShopCategoryPage({ params, searchParams }: PlpPageProps) {
  const { locale, category = [] } = await params;
  const search = await searchParams;
  const basePath = `/shop/${category.join('/')}`;
  const heading = category.length > 0 ? category.map(humanize).join(' / ') : 'Shop All';

  const scope = await resolveShopSegments(category);

  if (!scope.resolved) {
    return (
      <div className="flex flex-col gap-32 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
        <header className="flex flex-col gap-8 border-b border-line pb-24">
          <h1 className="font-display text-heading-1 tracking-display text-ink">{heading}</h1>
        </header>
        <div className="flex flex-col items-center gap-8 py-64 text-center">
          <p className="font-body text-body text-ink">Nothing here.</p>
          <p className="font-body text-body-sm text-mukaish">
            This category doesn&apos;t exist. Try Unstitched, Ready to Wear or Formal &amp; Wedding from the menu.
          </p>
        </div>
      </div>
    );
  }

  const selectedStitching = getSelected(search, 'stitching');
  const selectedBrand = getSelected(search, 'brand');
  const selectedFabric = getSelected(search, 'fabric');
  const selectedOccasion = getSelected(search, 'occasion');
  const selectedWork = getSelected(search, 'work');
  const selectedColor = getSelected(search, 'color');
  const selectedSize = getSelected(search, 'size');
  const selectedAvailability = getSelected(search, 'availability');
  const isSaleOnly = search.sale === '1';
  const priceMinAed = search.priceMin ? Number(search.priceMin) : null;
  const priceMaxAed = search.priceMax ? Number(search.priceMax) : null;
  const page = Math.max(1, Number(search.page) || 1);

  const hasActiveFilters =
    selectedStitching.length > 0 ||
    selectedBrand.length > 0 ||
    selectedFabric.length > 0 ||
    selectedOccasion.length > 0 ||
    selectedWork.length > 0 ||
    selectedColor.length > 0 ||
    selectedSize.length > 0 ||
    selectedAvailability.length > 0 ||
    isSaleOnly ||
    priceMinAed != null ||
    priceMaxAed != null;

  // The real `ListProductsQuery` accepts exactly one value per
  // stitchingType/fabric/work/occasion/colorFamily/size (a single optional
  // enum, not a list) — the checkbox UI stays multi-select in the URL
  // (unchanged from the placeholder version), but only the first selected
  // value per facet is actually sent to the API. See `lib/catalog-client.ts`.
  const selections: PlpFacetSelections = {
    ...(selectedStitching[0] ? { stitchingType: selectedStitching[0] as StitchingType } : {}),
    ...(selectedBrand[0] ? { brand: selectedBrand[0] } : {}),
    ...(selectedFabric[0] ? { fabric: selectedFabric[0] as Fabric } : {}),
    ...(selectedOccasion[0] ? { occasion: selectedOccasion[0] as Occasion } : {}),
    ...(selectedWork[0] ? { work: selectedWork[0] as Work } : {}),
    ...(selectedColor[0] ? { colorFamily: selectedColor[0] as ColorFamily } : {}),
    ...(selectedSize[0] ? { size: selectedSize[0] as Size } : {}),
    ...(priceMinAed != null ? { minPriceFils: priceMinAed * 100 } : {}),
    ...(priceMaxAed != null ? { maxPriceFils: priceMaxAed * 100 } : {}),
    ...(selectedAvailability.includes('in-stock') ? { inStock: true } : {}),
    ...(isSaleOnly ? { onSale: true } : {}),
    ...(search.sort ? { sort: search.sort as ProductSort } : {}),
  };

  const plpData = await loadPlpData(scope, selections, page);

  const visible = plpData.displayProducts.map((product) => toProductCardProps(product, locale));
  const hasMore = plpData.hasMore;
  const remainingCount = Math.max(plpData.total - plpData.displayProducts.length, 0);

  return (
    <div className="flex flex-col gap-32 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <header className="flex flex-col gap-8 border-b border-line pb-24">
        <h1 className="font-display text-heading-1 tracking-display text-ink">{heading}</h1>
        <p className="font-body text-body-sm text-mukaish">
          {plpData.total} {plpData.total === 1 ? 'result' : 'results'}
        </p>
      </header>

      <div className="flex flex-col gap-32 lg:flex-row lg:items-start lg:gap-48">
        <FilterRail
          groups={buildFacetGroupViews(buildFacetGroups(plpData.scopeProducts), basePath, search)}
          priceRangeFils={getPriceRange(plpData.scopeProducts)}
          clearHref={basePath}
          hasActiveFilters={hasActiveFilters}
        />

        <div className="flex flex-1 flex-col gap-32">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-8 py-64 text-center">
              <p className="font-body text-body text-ink">No results for these filters.</p>
              <p className="font-body text-body-sm text-mukaish">
                Try clearing a filter, or browse Unstitched, Ready to Wear and Formal &amp; Wedding from the menu.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-16 lg:grid-cols-3 lg:gap-24">
                {visible.map((product) => (
                  <ProductCard key={product.slug} {...product} />
                ))}
              </div>
              {hasMore ? <LoadMoreButton remainingCount={remainingCount} /> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
