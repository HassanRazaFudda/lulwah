import type { PlaceholderProduct } from './placeholder-data';

/**
 * Builds the PLP filter rail's facet data — plan.md §15.3: "Facets in this
 * order: Stitching type · Piece count · Brand · Fabric · Occasion · Work ·
 * Colour · Size · Price (histogram slider) · Availability · On sale. Every
 * facet shows counts."
 *
 * Counts are computed against the category-scoped product list only (not
 * cross-filtered against the *other* currently-selected facets) — a
 * deliberate simplification against a 9-item placeholder catalogue; a real
 * facet count would come from the search index (§7.14, Meilisearch) doing
 * proper cross-facet aggregation.
 */

export interface FacetOptionData {
  value: string;
  label: string;
  count: number;
}

export interface FacetGroupData {
  key: string;
  label: string;
  options: FacetOptionData[];
}

export function humanize(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .split(' ')
    .map((word) => {
      const [first, ...rest] = word;
      return first === undefined ? word : first.toUpperCase() + rest.join('');
    })
    .join(' ');
}

const STITCHING_LABELS: Record<string, string> = {
  unstitched: 'Unstitched',
  semi_stitched: 'Semi-stitched',
  pret: 'Ready to Wear',
  custom_stitchable: 'Custom Stitchable',
};

function countValues(products: PlaceholderProduct[], getValues: (product: PlaceholderProduct) => string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const product of products) {
    for (const value of getValues(product)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

function toOptions(counts: Map<string, number>, label: (value: string) => string): FacetOptionData[] {
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort((a, b) => b.count - a.count);
}

export function buildFacetGroups(products: PlaceholderProduct[]): FacetGroupData[] {
  const brandNameBySlug = new Map(products.map((product) => [product.brandSlug, product.brandName]));

  return [
    {
      key: 'stitching',
      label: 'Stitching type',
      options: toOptions(
        countValues(products, (p) => [p.stitchingType]),
        (value) => STITCHING_LABELS[value] ?? humanize(value),
      ),
    },
    {
      key: 'pieces',
      label: 'Piece count',
      options: toOptions(
        countValues(products, (p) => (p.pieceCount ? [String(p.pieceCount)] : [])),
        (value) => `${value} Piece${value === '1' ? '' : 's'}`,
      ),
    },
    {
      key: 'brand',
      label: 'Brand',
      options: toOptions(
        countValues(products, (p) => [p.brandSlug]),
        (value) => brandNameBySlug.get(value) ?? humanize(value),
      ),
    },
    {
      key: 'fabric',
      label: 'Fabric',
      options: toOptions(countValues(products, (p) => [p.fabric]), humanize),
    },
    {
      key: 'occasion',
      label: 'Occasion',
      options: toOptions(countValues(products, (p) => p.occasion), humanize),
    },
    {
      key: 'work',
      label: 'Work',
      options: toOptions(countValues(products, (p) => p.work), humanize),
    },
    {
      key: 'color',
      label: 'Colour',
      options: toOptions(countValues(products, (p) => [p.colorFamily]), humanize),
    },
    {
      key: 'size',
      label: 'Size',
      options: toOptions(
        countValues(products, (p) => p.sizes),
        (value) => value.toUpperCase(),
      ),
    },
    {
      key: 'availability',
      label: 'Availability',
      options: toOptions(countValues(products, (p) => [p.totalStock > 0 ? 'in-stock' : 'out-of-stock']), (value) =>
        value === 'in-stock' ? 'In stock' : 'Out of stock',
      ),
    },
    {
      key: 'sale',
      label: 'On sale',
      options: toOptions(
        countValues(products, (p) => (p.compareAtPriceFils != null && p.compareAtPriceFils > p.priceFils ? ['1'] : [])),
        () => 'On sale',
      ),
    },
  ];
}

export function getPriceRange(products: PlaceholderProduct[]): { minFils: number; maxFils: number } {
  if (products.length === 0) return { minFils: 0, maxFils: 0 };
  const prices = products.map((p) => p.priceFils);
  return { minFils: Math.min(...prices), maxFils: Math.max(...prices) };
}
