import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AccordionGroup, type AccordionItemData } from '@/components/commerce/AccordionGroup';
import { AddToBagForm } from '@/components/commerce/AddToBagForm';
import { PriceBlock } from '@/components/commerce/PriceBlock';
import { ProductCard } from '@/components/commerce/ProductCard';
import { ProductGallery } from '@/components/commerce/ProductGallery';
import { StitchingPill } from '@/components/commerce/StitchingPill';
import type { AppLocale } from '@/i18n/routing';
import { getProductBySlug, getRelatedProducts, PRODUCTS, toProductCardProps } from '@/lib/placeholder-data';

interface PdpPageProps {
  params: Promise<{ locale: AppLocale; slug: string }>;
}

/** plan.md §12.2: "PDP: ISR, generateStaticParams for the top 500 products, rest on-demand." All 9 placeholder products qualify. */
export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: PdpPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return {};
  return {
    title: `${product.title} — ${product.brandName}`,
    description: product.descriptionEn,
  };
}

export default async function ProductPage({ params }: PdpPageProps) {
  const { locale, slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const related = getRelatedProducts(slug, 3).map((item) => toProductCardProps(item, locale));

  const accordionItems: AccordionItemData[] = [
    {
      id: 'included',
      title: "What's included",
      content: (
        <ul className="flex flex-col gap-8">
          {product.piecesBreakdown.map((piece) => (
            <li key={piece.type} className="flex justify-between gap-16">
              <span className="capitalize">{piece.type}</span>
              <span className="tabular-nums text-mukaish">
                {piece.fabric}
                {piece.lengthMeters ? ` · ${piece.lengthMeters}m` : ''}
              </span>
            </li>
          ))}
        </ul>
      ),
    },
    { id: 'fabric-care', title: 'Fabric & care', content: <p>{product.fabricCare}</p> },
    {
      id: 'delivery-returns',
      title: 'Delivery & returns',
      content: (
        <p>
          2–4 day delivery across the UAE, AED 20 flat (free over AED 300). 14-day returns from delivery.{' '}
          {product.stitchingType === 'unstitched'
            ? 'This unstitched piece is returnable only if the fabric seal is intact.'
            : product.stitchingType === 'custom_stitchable'
              ? 'Custom-stitched pieces are made to your measurements and are non-returnable.'
              : ''}
        </p>
      ),
    },
    {
      id: 'about-brand',
      title: `About ${product.brandName}`,
      content: <p>A Pakistani design house carried by Lulwah Fashion, shipped to the UAE from Karachi and Lahore.</p>,
    },
  ];

  return (
    <div className="flex flex-col gap-64 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <div className="grid grid-cols-1 gap-32 lg:grid-cols-[58fr_42fr] lg:gap-48">
        <ProductGallery images={product.images} productTitle={product.title} />

        <div className="flex flex-col gap-24 lg:sticky lg:top-96 lg:self-start">
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <span className="font-body text-label font-semibold tracking-label text-mukaish uppercase">
                {product.brandName}
              </span>
              <span className="font-body text-body-sm text-mukaish">{product.articleCode}</span>
            </div>
            <h1 className="font-display text-heading-1 tracking-display text-ink">{product.title}</h1>
          </div>

          <div className="flex flex-col gap-4">
            <PriceBlock priceFils={product.priceFils} compareAtPriceFils={product.compareAtPriceFils} locale={locale} size="large" />
            <p className="font-body text-body-sm text-mukaish">VAT included</p>
          </div>

          <StitchingPill stitchingType={product.stitchingType} pieceCount={product.pieceCount} />

          <AddToBagForm product={product} />

          <AccordionGroup items={accordionItems} />

          <ul className="flex flex-col gap-8 border-t border-line pt-16 font-body text-body-sm text-ink-70">
            <li>Authentic pieces, sourced direct from Pakistan</li>
            <li>Cash on delivery available</li>
            <li>14-day returns</li>
          </ul>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="flex flex-col gap-24 border-t border-line pt-48">
          <h2 className="font-display text-heading-1 tracking-display text-ink">You may also like</h2>
          {/* Never 4-up — the grid rule (spec's design rules section) applies here too, even though `related` can have up to 4 items. */}
          <div className="grid grid-cols-2 gap-16 lg:grid-cols-3 lg:gap-24">
            {related.map((item) => (
              <ProductCard key={item.slug} {...item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
