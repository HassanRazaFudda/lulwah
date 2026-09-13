import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { listCollections } from '@/lib/catalog-client';
import { getLookbookBySlug } from '@/lib/content-client';
import { pickLocale } from '@/lib/content-mappers';

interface LookbookDetailPageProps {
  params: Promise<{ locale: AppLocale; slug: string }>;
}

/**
 * Lookbook detail — plan.md §3.2 feature 10. A Server Component fetching
 * `GET /content/lookbooks/:slug` directly (plan.md §5.2 — a public read
 * needs no BFF hop), same shape as the PDP/brand-page precedent: `notFound()`
 * on a real API 404 (draft or unknown slug never reaches this far —
 * `lookbook.service.ts` 404s it server-side), no `generateStaticParams`
 * (the real catalogue of lookbooks isn't known at build time, same tradeoff
 * `product/[slug]/page.tsx` and `brands/[slug]/page.tsx` already make).
 * `revalidate` matches this app's other CMS-driven *detail* page window
 * (PDP, §12.2: 600s ISR) rather than the shorter listing-page window.
 */
export const revalidate = 600;

export async function generateMetadata({ params }: LookbookDetailPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const lookbook = await getLookbookBySlug(slug);
  if (!lookbook) return {};
  const title = pickLocale(lookbook.seo.titleEn ?? lookbook.titleEn, lookbook.seo.titleAr ?? lookbook.titleAr, locale);
  const description = pickLocale(lookbook.seo.descEn ?? '', lookbook.seo.descAr ?? '', locale);
  return { title, ...(description ? { description } : {}) };
}

export default async function LookbookDetailPage({ params }: LookbookDetailPageProps) {
  const { locale, slug } = await params;
  const lookbook = await getLookbookBySlug(slug);
  if (!lookbook) notFound();

  const t = await getTranslations('lookbook');
  const title = pickLocale(lookbook.titleEn, lookbook.titleAr, locale);
  const body = pickLocale(lookbook.bodyEn, lookbook.bodyAr, locale);

  // `collectionId` is a bare reference, not a populated relation
  // (`packages/contracts/src/content.ts#Lookbook`'s own doc comment) — the
  // real resolution-to-a-link mechanism this codebase already establishes is
  // `app/[locale]/page.tsx`'s `CmsHomeComposition` (`collectionSlugById`,
  // built from a generous `listCollections(100)` call): a bare id has no
  // href of its own, so it's resolved to the real collection's slug and
  // pointed at the PLP the same way `(shop)/collections/page.tsx` already
  // links every collection card (`/shop/:slug`, not `/collections/:slug` —
  // no per-collection `layout` template is rendered by any route yet).
  let shopHref: string | null = null;
  if (lookbook.collectionId) {
    const collections = await listCollections(100);
    const collection = collections.find((c) => c.id === lookbook.collectionId);
    if (collection) shopHref = `/shop/${collection.slug}`;
  }

  return (
    <div className="flex flex-col gap-48 pb-64">
      {lookbook.heroMedia ? (
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-pearl lg:aspect-[21/9]">
          <Image src={lookbook.heroMedia.url} alt={title} fill priority sizes="100vw" className="object-cover" />
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-24 px-24">
        <h1 className="font-display text-display-2 tracking-display text-ink">{title}</h1>

        {body ? (
          // `bodyEn`/`bodyAr` arrive pre-sanitized from the API — the
          // `content` module runs every rich-text field through
          // `sanitize.ts` (isomorphic-dompurify) before it's ever persisted,
          // so this is safe to render directly, same trust boundary this
          // codebase's other `Page`/`JournalPost`-shaped bodies share.
          <div
            className="flex flex-col gap-16 font-body text-body text-ink-70 [&_a]:underline [&_h2]:font-display [&_h2]:text-heading-1 [&_h2]:text-ink"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : null}

        {shopHref ? (
          <Link
            href={shopHref}
            className="mt-8 inline-block w-fit font-body text-body font-medium text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
          >
            {t('shopThisLook')}
          </Link>
        ) : null}
      </div>

      {lookbook.gallery.length > 0 ? (
        <div className="grid grid-cols-2 gap-16 px-24 lg:grid-cols-3 lg:gap-24 lg:px-[clamp(24px,5vw,88px)]">
          {lookbook.gallery.map((media, index) => (
            <div key={`${media.publicId}-${index}`} className="relative aspect-[3/4] overflow-hidden bg-pearl">
              <Image src={media.url} alt="" fill sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
