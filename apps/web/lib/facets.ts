import type { Brand, Product } from '@lulwah/contracts';

/**
 * Builds the PLP filter rail's facet data — plan.md §15.3: "Facets in this
 * order: Stitching type · Piece count · Brand · Fabric · Occasion · Work ·
 * Colour · Size · Price (histogram slider) · Availability · On sale. Every
 * facet shows counts."
 *
 * Operates on real `Product[]` (`@lulwah/contracts`) — this used to run
 * against `PlaceholderProduct[]`; swapped when the PLP moved to a real
 * `apiFetch('/products', ...)` call. Counts are computed against the
 * *category/collection-scoped* product list the PLP fetches separately
 * (unfiltered by the other facets), same simplification the placeholder
 * version already documented: a real cross-facet aggregation would come
 * from the search index (§7.14, Meilisearch), not from summing an
 * already-fetched page of results client^Wserver-side.
 *
 * Two facets have real gaps against the real API, handled differently:
 * - "Size" only exists per-`Variant`, and `GET /products` doesn't embed
 *   variants — no per-size counts are computable from the list response.
 *   Its group always renders empty, but the `size` **query param** still
 *   works if a caller sets it directly (`ListProductsQuery.size`, resolved
 *   server-side via a variant lookup) — so it's kept as a real, functional,
 *   just uncounted filter. `FilterRail`'s Price control (anchored next to
 *   Size) is deliberately decoupled from Size being non-empty so Price
 *   doesn't disappear along with it — see that component.
 * - "Piece count" has no backing param in `ListProductsQuery` at all (no
 *   `pieceCount` field exists on it) — there is no way to ask the real API
 *   to filter by this, counted or not. Rather than render a checkbox that
 *   silently does nothing when clicked, this facet is omitted entirely.
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

function countValues(products: Product[], getValues: (product: Product) => string[]): Map<string, number> {
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

export function buildFacetGroups(products: Product[], brands: Brand[]): FacetGroupData[] {
  const brandById = new Map(brands.map((brand) => [brand.id, brand]));
  const brandNameBySlug = new Map(brands.map((brand) => [brand.slug, brand.name]));

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
      key: 'brand',
      label: 'Brand',
      options: toOptions(
        countValues(products, (p) => {
          const brand = brandById.get(p.brandId);
          return brand ? [brand.slug] : [];
        }),
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
    // No per-product size data available from `GET /products` — see this
    // file's doc comment. Always empty by design, not a bug.
    { key: 'size', label: 'Size', options: [] },
    {
      key: 'availability',
      label: 'Availability',
      options: toOptions(countValues(products, (p) => [p.inStock ? 'in-stock' : 'out-of-stock']), (value) =>
        value === 'in-stock' ? 'In stock' : 'Out of stock',
      ),
    },
    {
      key: 'sale',
      label: 'On sale',
      options: toOptions(
        countValues(products, (p) => (p.discountPercent > 0 ? ['1'] : [])),
        () => 'On sale',
      ),
    },
  ];
}

export function getPriceRange(products: Product[]): { minFils: number; maxFils: number } {
  if (products.length === 0) return { minFils: 0, maxFils: 0 };
  const prices = products.map((p) => p.effectivePriceFils);
  return { minFils: Math.min(...prices), maxFils: Math.max(...prices) };
}
