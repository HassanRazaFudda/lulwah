import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { AppLocale } from '@/i18n/routing';
import { getJournalPostBySlug } from '@/lib/content-client';
import { pickLocale } from '@/lib/content-mappers';

interface JournalDetailPageProps {
  params: Promise<{ locale: AppLocale; slug: string }>;
}

/**
 * Journal post detail — plan.md §3.2 feature 10. Same fetch/404/ISR shape
 * as the Lookbook detail page and the PDP before it: `GET
 * /content/journal/:slug` (published only, the service layer 404s a draft
 * or unknown slug), `notFound()` on a real API 404, no `generateStaticParams`,
 * `revalidate` matching this app's other CMS-driven detail-page window
 * (600s, same as PDP/Lookbook detail).
 */
export const revalidate = 600;

export async function generateMetadata({ params }: JournalDetailPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getJournalPostBySlug(slug);
  if (!post) return {};
  const title = pickLocale(post.seo.titleEn ?? post.titleEn, post.seo.titleAr ?? post.titleAr, locale);
  const description = pickLocale(post.seo.descEn ?? post.excerptEn, post.seo.descAr ?? post.excerptAr, locale);
  return { title, ...(description ? { description } : {}) };
}

export default async function JournalDetailPage({ params }: JournalDetailPageProps) {
  const { locale, slug } = await params;
  const post = await getJournalPostBySlug(slug);
  if (!post) notFound();

  const title = pickLocale(post.titleEn, post.titleAr, locale);
  const body = pickLocale(post.bodyEn, post.bodyAr, locale);

  return (
    <article className="mx-auto flex max-w-[720px] flex-col gap-24 px-24 py-32 lg:py-64">
      {post.coverMedia ? (
        <div className="relative aspect-[3/2] w-full overflow-hidden bg-pearl">
          <Image src={post.coverMedia.url} alt={title} fill priority sizes="(min-width: 1024px) 720px, 100vw" className="object-cover" />
        </div>
      ) : null}

      <h1 className="font-display text-display-2 tracking-display text-ink">{title}</h1>

      {body ? (
        // `bodyEn`/`bodyAr` arrive pre-sanitized from the API — the `content`
        // module runs every rich-text field through `sanitize.ts`
        // (isomorphic-dompurify) before it's ever persisted, so this is safe
        // to render directly, same trust boundary the Lookbook detail page
        // (and this codebase's `Page` type) already shares.
        <div
          className="flex flex-col gap-16 font-body text-body text-ink-70 [&_a]:underline [&_h2]:font-display [&_h2]:text-heading-1 [&_h2]:text-ink"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      ) : null}
    </article>
  );
}
