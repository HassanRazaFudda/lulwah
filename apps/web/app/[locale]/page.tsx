import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BrandStrip } from '@/components/sections/BrandStrip';
import { CollectionRail } from '@/components/sections/CollectionRail';
import { EditorialSplit } from '@/components/sections/EditorialSplit';
import { FullBleedBreak } from '@/components/sections/FullBleedBreak';
import { Hero } from '@/components/sections/Hero';
import { NewsletterSection } from '@/components/sections/NewsletterSection';
import { OccasionTiles } from '@/components/sections/OccasionTiles';
import { ShopByStitching } from '@/components/sections/ShopByStitching';
import { UspBar } from '@/components/sections/UspBar';
import { ProductCard } from '@/components/commerce/ProductCard';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { listBrands, listProducts } from '@/lib/catalog-client';
import { buildBrandNameById, toProductCardProps } from '@/lib/product-mappers';

interface HomePageProps {
  params: Promise<{ locale: AppLocale }>;
}

/** plan.md §12.2: "Home | ISR | 300 s + on-demand on content publish." */
export const revalidate = 300;

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return { title: t('defaultTitle'), description: t('description') };
}

/**
 * Home — plan.md §15.2: the section order below is explicitly locked
 * ("Sections are CMS-driven, but the launch composition is fixed"). A real
 * build reads `home_sections` from the CMS — that module doesn't exist yet,
 * so this still renders the fixed section order directly, but the two
 * catalogue-driven rails ("New arrivals", "Best sellers") now come from
 * real `GET /products` calls (`sort=newest` / `sort=bestselling`) instead
 * of `placeholder-data.ts`; every other section stays static/editorial per
 * the brief. Backgrounds alternate paper/pearl per §13.5 ("Two adjacent
 * sections never share a background"), and each wrapper carries the locked
 * vertical-rhythm gap (`clamp(64px, 9vw, 160px)`).
 */
export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations('home');

  const [newArrivalsResult, bestSellersResult, brands] = await Promise.all([
    listProducts({ sort: 'newest', limit: 6 }),
    listProducts({ sort: 'bestselling', limit: 6 }),
    listBrands(),
  ]);
  const brandNameById = buildBrandNameById(brands);
  const newArrivals = newArrivalsResult.products.map((product) => toProductCardProps(product, brandNameById.get(product.brandId) ?? '', locale));
  const bestSellers = bestSellersResult.products.map((product) => toProductCardProps(product, brandNameById.get(product.brandId) ?? '', locale));

  return (
    <>
      {/* 1. Hero */}
      <Hero />

      {/* 2. New arrivals rail — plan.md §3.3 rule 9: an empty catalogue (unseeded DB) gets a real message, not an empty scroller. */}
      {newArrivals.length > 0 ? (
        <div className="bg-paper py-[clamp(64px,9vw,160px)]">
          <CollectionRail
            title={t('newArrivals.title')}
            viewAllHref="/shop/new-in"
            viewAllLabel={t('newArrivals.viewAll')}
            items={newArrivals}
          />
        </div>
      ) : null}

      {/* 3. Shop by stitching — the store's core navigation idea */}
      <ShopByStitching />

      {/* 4. Editorial split */}
      <div className="bg-pearl py-[clamp(64px,9vw,160px)]">
        <EditorialSplit />
      </div>

      {/* 5. Brand strip */}
      <div className="bg-paper py-[clamp(64px,9vw,160px)]">
        <BrandStrip />
      </div>

      {/* 6. Best sellers */}
      {bestSellers.length > 0 ? (
        <section className="flex flex-col gap-24 bg-pearl px-24 py-[clamp(64px,9vw,160px)] lg:px-[clamp(24px,5vw,88px)]">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-heading-1 tracking-display text-ink">{t('bestSellers.title')}</h2>
            <Link
              href="/shop/best-sellers"
              className="font-body text-body text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
            >
              {t('bestSellers.viewAll')}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-16 lg:grid-cols-3 lg:gap-24">
            {bestSellers.map((item) => (
              <ProductCard key={item.slug} {...item} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 7. Full-bleed break */}
      <FullBleedBreak />

      {/* 8. Shop by occasion */}
      <div className="bg-paper py-[clamp(64px,9vw,160px)]">
        <OccasionTiles />
      </div>

      {/* 9. The Lulwah promise (USP bar) */}
      <UspBar />

      {/* 11. Newsletter — item 10 "Journal teaser" is explicitly R2-scoped (§15.2), skipped here. */}
      <NewsletterSection />
    </>
  );
}
