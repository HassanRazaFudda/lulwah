import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { LoadMoreButton } from '@/components/commerce/LoadMoreButton';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { getJournalPosts } from '@/lib/content-client';
import { pickLocale } from '@/lib/content-mappers';

/** Matches `lib/plp-data.ts`'s own `PAGE_SIZE` for a 3-up desktop grid. */
const PAGE_SIZE = 6;

interface JournalIndexPageProps {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ page?: string }>;
}

/**
 * Journal index — plan.md §3.2 feature 10, §12.1's `(content)` route group.
 * `GET /content/journal?page&limit` (`apps/api/.../content/journal.routes.ts`)
 * returns published posts, newest-first, real-paginated. Pagination follows
 * plan.md §15.3's own rule ("Load more button ... with real ?page= URLs"),
 * reusing the exact "cumulative slice" trick `lib/plp-data.ts#loadPlpData`
 * already established for the PLP: always request `page: 1`, growing
 * `limit` to `page * PAGE_SIZE` as the shared `LoadMoreButton` bumps the
 * `?page=` search param — a real, shareable URL rendered cumulatively, not a
 * client-only fetch-and-append.
 */
export const revalidate = 300;

export async function generateMetadata({ params }: JournalIndexPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'journal' });
  return { title: t('title') };
}

export default async function JournalIndexPage({ params, searchParams }: JournalIndexPageProps) {
  const { locale } = await params;
  const search = await searchParams;
  const t = await getTranslations('journal');
  const page = Math.max(1, Number(search.page) || 1);

  const result = await getJournalPosts({ page: 1, limit: page * PAGE_SIZE });

  return (
    <div className="flex flex-col gap-32 px-24 py-32 lg:px-[clamp(24px,5vw,88px)]">
      <h1 className="font-display text-heading-1 tracking-display text-ink">{t('title')}</h1>

      {result.posts.length === 0 ? (
        <p className="font-body text-body text-mukaish">{t('empty')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-16 lg:grid-cols-3 lg:gap-24">
            {result.posts.map((post) => {
              const title = pickLocale(post.titleEn, post.titleAr, locale);
              const excerpt = pickLocale(post.excerptEn, post.excerptAr, locale);
              return (
                <Link key={post.slug} href={`/journal/${post.slug}`} className="group flex flex-col gap-12">
                  <div className="relative aspect-[4/5] overflow-hidden bg-pearl">
                    {post.coverMedia ? (
                      <Image
                        src={post.coverMedia.url}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 33vw, 50vw"
                        className="object-cover transition-transform duration-slow ease-cloth group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-4">
                    <h2 className="font-display text-heading-2 tracking-display text-ink">{title}</h2>
                    {excerpt ? <p className="font-body text-body-sm text-ink-70">{excerpt}</p> : null}
                  </div>
                </Link>
              );
            })}
          </div>
          {result.hasMore ? <LoadMoreButton remainingCount={Math.max(result.total - result.posts.length, 0)} /> : null}
        </>
      )}
    </div>
  );
}
