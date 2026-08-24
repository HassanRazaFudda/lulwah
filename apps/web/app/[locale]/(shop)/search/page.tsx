import type { Metadata } from 'next';
import { Input } from '@lulwah/ui';
import { ProductCard } from '@/components/commerce/ProductCard';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { listBrands, listCollections, searchProducts } from '@/lib/catalog-client';
import { buildBrandNameById, toProductCardProps } from '@/lib/product-mappers';

export const metadata: Metadata = {
  title: 'Search',
};

/** plan.md §12.2: "Search | SSR (`dynamic`) | no cache." (Already forced dynamic implicitly by reading `searchParams`; declared explicitly to match the spec's row.) */
export const dynamic = 'force-dynamic';

/**
 * plan.md §12.2: "Search | SSR (`dynamic`) | no cache" and §2.7: "Article
 * code is a searchable, indexed, displayed field. Search must match it
 * exactly and fuzzily." Wired to `GET /search?q=` — Meilisearch-backed with
 * a Mongo-regex fallback when Meilisearch is unreachable, both transparent
 * to this page (`search.service.ts`'s `source` field is available on the
 * response but not surfaced in the UI; it never turns into an HTTP error).
 * The zero-results state's "nearest collections" suggestion (§15.3) is real
 * `GET /collections` data, not placeholder links.
 */
interface SearchPageProps {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  const { q = '' } = await searchParams;
  const query = q.trim();

  const [{ products: results }, brands] = await Promise.all([searchProducts(query, 24), listBrands()]);
  const brandNameById = buildBrandNameById(brands);
  const cards = results.map((product) => toProductCardProps(product, brandNameById.get(product.brandId) ?? '', locale));

  const nearestCollections = query && results.length === 0 ? (await listCollections(3)).slice(0, 3) : [];

  return (
    <div className="flex flex-col gap-32 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <h1 className="font-display text-heading-1 tracking-display text-ink">Search</h1>
      <form action={`/${locale}/search`} method="get" className="max-w-[480px]">
        <Input type="search" name="q" label="Search products or article code" defaultValue={q} />
      </form>

      {query ? (
        <p className="font-body text-body-sm text-mukaish">
          {results.length} {results.length === 1 ? 'result' : 'results'} for &ldquo;{q}&rdquo;
        </p>
      ) : null}

      {query && results.length === 0 ? (
        <div className="flex flex-col gap-16 py-32">
          <div className="flex flex-col gap-8">
            <p className="font-body text-body text-ink">No results for &ldquo;{q}&rdquo;.</p>
            <p className="font-body text-body-sm text-mukaish">
              Try the article code printed on the brand&apos;s tag, check the spelling, or browse one of these instead.
            </p>
          </div>
          {nearestCollections.length > 0 ? (
            <ul className="flex flex-wrap gap-8">
              {nearestCollections.map((collection) => (
                <li key={collection.slug}>
                  <Link
                    href={`/shop/${collection.slug}`}
                    className="inline-flex h-40 items-center border border-ink-20 px-16 font-body text-body-sm text-ink transition-colors duration-fast ease-out hover:border-ink"
                  >
                    {collection.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {cards.length > 0 ? (
        <div className="grid grid-cols-2 gap-16 lg:grid-cols-3 lg:gap-24">
          {cards.map((product) => (
            <ProductCard key={product.slug} {...product} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
