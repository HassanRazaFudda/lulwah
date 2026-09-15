import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { getLookbooks } from '@/lib/content-client';
import { pickLocale } from '@/lib/content-mappers';

interface LookbookIndexPageProps {
  params: Promise<{ locale: AppLocale }>;
}

/**
 * Lookbook index — plan.md §3.2 feature 10 ("Lookbook / editorial pages")
 * and §12.1's `(content)` route group (same group `faq`/`about` already
 * live in). `GET /content/lookbooks` (`apps/api/.../content/lookbook.routes.ts`)
 * returns only published lookbooks, already sorted by `sortOrder` — see
 * `lib/content-client.ts#getLookbooks`'s own doc comment.
 *
 * `force-dynamic`, not the 300s ISR this page originally matched Home on
 * — same reasoning as `app/[locale]/page.tsx`'s own doc comment: this is
 * a build-time-prerendered listing page with no dynamic route segment,
 * so it hits the identical "Coolify's build can't reach the API, bakes
 * in an empty/wrong result permanently" failure mode Home actually hit
 * in production.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: LookbookIndexPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'lookbook' });
  return { title: t('title') };
}

export default async function LookbookIndexPage({ params }: LookbookIndexPageProps) {
  const { locale } = await params;
  const t = await getTranslations('lookbook');
  const lookbooks = await getLookbooks();

  return (
    <div className="flex flex-col gap-32 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <h1 className="font-display text-heading-1 tracking-display text-ink">{t('title')}</h1>

      {lookbooks.length === 0 ? (
        <p className="font-body text-body text-mukaish">{t('empty')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-3 lg:gap-24">
          {lookbooks.map((lookbook) => {
            const title = pickLocale(lookbook.titleEn, lookbook.titleAr, locale);
            // `heroMedia` is the primary tile image; a lookbook with no hero
            // set yet (an in-progress admin draft that somehow got published)
            // falls back to its first gallery image rather than an empty tile.
            const image = lookbook.heroMedia ?? lookbook.gallery[0] ?? null;
            return (
              <Link
                key={lookbook.slug}
                href={`/lookbook/${lookbook.slug}`}
                className="group relative aspect-[3/4] overflow-hidden bg-pearl"
              >
                {image ? (
                  <Image
                    src={image.url}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="object-cover transition-transform duration-slow ease-cloth group-hover:scale-105"
                  />
                ) : null}
                <div className="absolute inset-0 bg-ink/35" />
                <div className="absolute inset-x-0 bottom-16 flex flex-col gap-4 px-16">
                  <h2 className="font-display text-heading-1 tracking-display text-paper">{title}</h2>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
