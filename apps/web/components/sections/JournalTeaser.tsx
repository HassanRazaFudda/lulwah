import Image from 'next/image';
import { Link } from '@/i18n/navigation';

export interface JournalTeaserItem {
  slug: string;
  title: string;
  excerpt: string;
  image: { src: string; alt: string } | null;
}

export interface JournalTeaserProps {
  title: string;
  items: JournalTeaserItem[];
}

/**
 * `journal_teaser` home section (plan.md §15.2 item 10, R2-scoped — real
 * `JournalPost`s now exist via the `content` module). `app/[locale]/page.tsx`'s
 * `CmsHomeComposition` resolves `JournalTeaserSectionSettings.postSlugs`
 * (`packages/contracts/src/content.ts`) through `GET /content/journal?slugs=`
 * (dropping any unknown/draft slug, preserving the admin's own order) and
 * locale-picks each post's title/excerpt before handing this component
 * plain `items` — the same "pre-resolved data in, purely presentational"
 * contract `CollectionRail` already establishes for this page's other rails,
 * rather than this component reaching for `settings`/`locale` itself.
 *
 * `href`s are real internal post routes (`/journal/[slug]`), never
 * CMS-authored free text, so this uses `Link` directly rather than
 * `ContentLink` (reserved for an admin-typed href that could be external —
 * see that component's own doc comment).
 */
export function JournalTeaser({ title, items }: JournalTeaserProps) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-24 px-24 lg:px-[clamp(24px,5vw,88px)]">
      <h2 className="font-display text-heading-1 tracking-display text-ink">{title}</h2>
      {/* 2-up mobile / 3-up desktop — plan.md's "never a uniform 4-up grid"
          rule applies here too (§13.2's banned-list, §15.4's PDP "You may
          also like" precedent), even though up to 4 posts can be configured
          (`JournalTeaserSectionSettings.postSlugs` caps at 4) — a 4th item
          simply wraps onto its own row on desktop instead of forcing a
          4-column layout. */}
      <div className="grid grid-cols-2 gap-16 lg:grid-cols-3 lg:gap-24">
        {items.map((item) => (
          <Link key={item.slug} href={`/journal/${item.slug}`} className="group flex flex-col gap-12">
            <div className="relative aspect-[4/5] overflow-hidden bg-pearl">
              {item.image ? (
                <Image
                  src={item.image.src}
                  alt={item.image.alt}
                  fill
                  sizes="(min-width: 1024px) 33vw, 50vw"
                  className="object-cover transition-transform duration-slow ease-cloth group-hover:scale-105"
                />
              ) : null}
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="font-display text-heading-2 tracking-display text-ink">{item.title}</h3>
              {item.excerpt ? <p className="font-body text-body-sm text-ink-70">{item.excerpt}</p> : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
