import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/commerce/ProductCard';
import type { AppLocale } from '@/i18n/routing';
import { getBrandBySlug, listProducts } from '@/lib/catalog-client';
import { toProductCardProps } from '@/lib/product-mappers';

/**
 * Brand house page — plan.md §12.1 `/brands/[slug]`, §3.2 feature 3
 * ("Brand pages"). Wired to `GET /brands/:slug` + `GET /products?brand=`
 * (the API resolves `brand` as a slug, matching this route's own param).
 * `generateStaticParams` (ISR pre-listing) is dropped along with the
 * placeholder version's fixed 6-brand array — real brands aren't known at
 * build time, so this renders on-demand instead, same tradeoff the PDP
 * makes.
 */
interface BrandPageProps {
  params: Promise<{ locale: AppLocale; slug: string }>;
}

export const revalidate = 300;

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) return {};
  return {
    title: brand.name,
    description: `Shop ${brand.name}: Pakistani designer wear, delivered across the UAE in 2–4 days.`,
  };
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { locale, slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();

  const { products } = await listProducts({ brand: slug, limit: 100, sort: 'newest' });
  const brandProducts = products.map((product) => toProductCardProps(product, brand.name, locale));

  return (
    <div className="flex flex-col gap-32 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <header className="flex flex-col gap-8 border-b border-line pb-24">
        <p className="font-body text-label font-semibold tracking-label text-mukaish uppercase">
          {brand.countryOfOrigin === 'PK' ? 'Pakistan' : brand.countryOfOrigin}
        </p>
        <h1 className="font-display text-display-2 tracking-display text-ink">{brand.name}</h1>
        {brand.description ? <p className="max-w-[640px] font-body text-body text-ink-70">{brand.description}</p> : null}
      </header>
      {brandProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-16 lg:grid-cols-3 lg:gap-24">
          {brandProducts.map((item) => (
            <ProductCard key={item.slug} {...item} />
          ))}
        </div>
      ) : (
        <p className="font-body text-body text-mukaish">No pieces from {brand.name} in stock right now.</p>
      )}
    </div>
  );
}
