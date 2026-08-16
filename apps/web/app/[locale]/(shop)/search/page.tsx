import type { Metadata } from 'next';
import { Input } from '@lulwah/ui';
import { ProductCard } from '@/components/commerce/ProductCard';
import type { AppLocale } from '@/i18n/routing';
import { PRODUCTS, toProductCardProps } from '@/lib/placeholder-data';

export const metadata: Metadata = {
  title: 'Search',
};

/**
 * plan.md §12.2: "Search | SSR (`dynamic`) | no cache" and §2.7: "Article
 * code is a searchable, indexed, displayed field. Search must match it
 * exactly and fuzzily." This does exact/substring matching against title,
 * brand and article code against the placeholder catalogue — a real build
 * replaces this with a Meilisearch query (§4.2) for actual typo tolerance.
 */
interface SearchPageProps {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  const { q = '' } = await searchParams;
  const query = q.trim().toLowerCase();

  const results = query
    ? PRODUCTS.filter(
        (product) =>
          product.title.toLowerCase().includes(query) ||
          product.brandName.toLowerCase().includes(query) ||
          product.articleCode.toLowerCase().includes(query),
      )
    : [];

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
        <div className="flex flex-col gap-8 py-32">
          <p className="font-body text-body text-ink">No results for &ldquo;{q}&rdquo;.</p>
          <p className="font-body text-body-sm text-mukaish">
            Try the article code printed on the brand&apos;s tag, or browse Unstitched, Ready to Wear and Formal &amp;
            Wedding from the menu.
          </p>
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="grid grid-cols-2 gap-16 lg:grid-cols-3 lg:gap-24">
          {results.map((product) => (
            <ProductCard key={product.slug} {...toProductCardProps(product, locale)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
