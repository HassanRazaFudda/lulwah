import type { Metadata } from 'next';
import { ProductCard } from '@/components/commerce/ProductCard';
import { FilterRail, type FilterGroupView, type FilterOptionView } from '@/components/commerce/FilterRail';
import { LoadMoreButton } from '@/components/commerce/LoadMoreButton';
import type { AppLocale } from '@/i18n/routing';
import { buildFacetGroups, getPriceRange, humanize } from '@/lib/facets';
import { PRODUCTS, toProductCardProps, type PlaceholderProduct } from '@/lib/placeholder-data';

/**
 * PLP — plan.md §15.3. `[...category]` is a real Next.js catch-all, so
 * every category path in the site (`/shop/unstitched`, `/shop/sale`,
 * `/shop/eid`, ...) resolves through this one route, exactly like §12.1's
 * route map. `matchesCategorySegments` stands in for the real
 * Meilisearch-backed category/facet resolution (§7.14) against the
 * placeholder catalogue.
 */
const PAGE_SIZE = 6;
type SearchParamsRecord = Record<string, string | string[] | undefined>;

function matchesCategorySegments(product: PlaceholderProduct, segments: string[]): boolean {
  return segments.every((segment) => {
    switch (segment) {
      case 'unstitched':
      case 'pret':
      case 'semi-stitched':
      case 'custom-stitchable':
        return product.stitchingType === segment.replace('-', '_');
      case 'formal-wedding':
        return product.occasion.some((o) => ['barat', 'walima', 'nikkah', 'mehndi', 'bridal'].includes(o));
      case 'sale':
        return product.compareAtPriceFils != null && product.compareAtPriceFils > product.priceFils;
      case 'new-in':
        return product.badges.includes('new');
      case 'best-sellers':
        return product.badges.includes('bestseller');
      case 'everyday':
      case 'eid':
      case 'mehndi':
      case 'barat':
      case 'walima':
        return product.occasion.includes(segment);
      default:
        return product.brandSlug === segment;
    }
  });
}

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
  products: PlaceholderProduct[],
  basePath: string,
  searchParams: SearchParamsRecord,
): FilterGroupView[] {
  const rawGroups = buildFacetGroups(products);
  return rawGroups.map((group) => {
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
  const heading = category.length > 0 ? category.map(humanize).join(' — ') : 'Shop All';
  return {
    title: `${heading} in the UAE`,
    description: `Shop ${heading} from Pakistan's leading designer houses, delivered across the UAE in 2–4 days.`,
  };
}

export default async function ShopCategoryPage({ params, searchParams }: PlpPageProps) {
  const { locale, category = [] } = await params;
  const search = await searchParams;
  const basePath = `/shop/${category.join('/')}`;

  const categoryScoped = PRODUCTS.filter((product) => matchesCategorySegments(product, category));

  const selectedStitching = getSelected(search, 'stitching');
  const selectedPieces = getSelected(search, 'pieces');
  const selectedBrand = getSelected(search, 'brand');
  const selectedFabric = getSelected(search, 'fabric');
  const selectedOccasion = getSelected(search, 'occasion');
  const selectedWork = getSelected(search, 'work');
  const selectedColor = getSelected(search, 'color');
  const selectedSize = getSelected(search, 'size');
  const selectedAvailability = getSelected(search, 'availability');
  const isSaleOnly = search.sale === '1';
  const priceMin = search.priceMin ? Number(search.priceMin) * 100 : null;
  const priceMax = search.priceMax ? Number(search.priceMax) * 100 : null;

  let filtered = categoryScoped;
  if (selectedStitching.length) filtered = filtered.filter((p) => selectedStitching.includes(p.stitchingType));
  if (selectedPieces.length) filtered = filtered.filter((p) => p.pieceCount != null && selectedPieces.includes(String(p.pieceCount)));
  if (selectedBrand.length) filtered = filtered.filter((p) => selectedBrand.includes(p.brandSlug));
  if (selectedFabric.length) filtered = filtered.filter((p) => selectedFabric.includes(p.fabric));
  if (selectedOccasion.length) filtered = filtered.filter((p) => p.occasion.some((o) => selectedOccasion.includes(o)));
  if (selectedWork.length) filtered = filtered.filter((p) => p.work.some((w) => selectedWork.includes(w)));
  if (selectedColor.length) filtered = filtered.filter((p) => selectedColor.includes(p.colorFamily));
  if (selectedSize.length) filtered = filtered.filter((p) => p.sizes.some((s) => selectedSize.includes(s)));
  if (selectedAvailability.includes('in-stock')) filtered = filtered.filter((p) => p.totalStock > 0);
  if (isSaleOnly) filtered = filtered.filter((p) => p.compareAtPriceFils != null && p.compareAtPriceFils > p.priceFils);
  if (priceMin != null) filtered = filtered.filter((p) => p.priceFils >= priceMin);
  if (priceMax != null) filtered = filtered.filter((p) => p.priceFils <= priceMax);

  const page = Math.max(1, Number(search.page) || 1);
  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  const hasActiveFilters =
    selectedStitching.length > 0 ||
    selectedPieces.length > 0 ||
    selectedBrand.length > 0 ||
    selectedFabric.length > 0 ||
    selectedOccasion.length > 0 ||
    selectedWork.length > 0 ||
    selectedColor.length > 0 ||
    selectedSize.length > 0 ||
    selectedAvailability.length > 0 ||
    isSaleOnly ||
    priceMin != null ||
    priceMax != null;

  const heading = category.length > 0 ? category.map(humanize).join(' — ') : 'Shop All';

  return (
    <div className="flex flex-col gap-32 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <header className="flex flex-col gap-8 border-b border-line pb-24">
        <h1 className="font-display text-heading-1 tracking-display text-ink">{heading}</h1>
        <p className="font-body text-body-sm text-mukaish">
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </p>
      </header>

      <div className="flex flex-col gap-32 lg:flex-row lg:items-start lg:gap-48">
        <FilterRail
          groups={buildFacetGroupViews(categoryScoped, basePath, search)}
          priceRangeFils={getPriceRange(categoryScoped)}
          clearHref={basePath}
          hasActiveFilters={hasActiveFilters}
        />

        <div className="flex flex-1 flex-col gap-32">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-8 py-64 text-center">
              <p className="font-body text-body text-ink">No results for these filters.</p>
              <p className="font-body text-body-sm text-mukaish">
                Try clearing a filter, or browse Unstitched, Ready to Wear and Formal & Wedding from the menu.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-16 lg:grid-cols-3 lg:gap-24">
                {visible.map((product) => (
                  <ProductCard key={product.slug} {...toProductCardProps(product, locale)} />
                ))}
              </div>
              {hasMore ? <LoadMoreButton remainingCount={filtered.length - visible.length} /> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
