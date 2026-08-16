import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/commerce/ProductCard';
import type { AppLocale } from '@/i18n/routing';
import { BRANDS, PRODUCTS, toProductCardProps } from '@/lib/placeholder-data';

/**
 * Brand house page — plan.md §12.1 `/brands/[slug]`, §3.2 feature 3
 * ("Brand pages"). Not in this workstream's explicit file list, but
 * `BrandStrip`/`Footer`/`brands` index all link here (§15.2 item 5: "each
 * links to a brand house page") — added so those links resolve to a real
 * page rather than a 404, kept as a minimal stub (no `coverVideo`/brand
 * story CMS content wired, §7.3).
 */
interface BrandPageProps {
  params: Promise<{ locale: AppLocale; slug: string }>;
}

export function generateStaticParams() {
  return BRANDS.map((brand) => ({ slug: brand.slug }));
}

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = BRANDS.find((b) => b.slug === slug);
  if (!brand) return {};
  return {
    title: brand.name,
    description: `Shop ${brand.name} — Pakistani designer wear, delivered across the UAE in 2–4 days.`,
  };
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { locale, slug } = await params;
  const brand = BRANDS.find((b) => b.slug === slug);
  if (!brand) notFound();

  const brandProducts = PRODUCTS.filter((product) => product.brandSlug === slug).map((product) =>
    toProductCardProps(product, locale),
  );

  return (
    <div className="flex flex-col gap-32 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <header className="flex flex-col gap-8 border-b border-line pb-24">
        <p className="font-body text-label font-semibold tracking-label text-mukaish uppercase">Pakistan</p>
        <h1 className="font-display text-display-2 tracking-display text-ink">{brand.name}</h1>
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
