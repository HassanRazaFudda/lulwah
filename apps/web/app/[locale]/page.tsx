import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CollectionRail } from '@/components/sections/CollectionRail';
import { EditorialSplit } from '@/components/sections/EditorialSplit';
import { FullBleedBreak } from '@/components/sections/FullBleedBreak';
import { Hero } from '@/components/sections/Hero';
import { JournalTeaser, type JournalTeaserItem } from '@/components/sections/JournalTeaser';
import { NewsletterSection } from '@/components/sections/NewsletterSection';
import { OccasionTiles } from '@/components/sections/OccasionTiles';
import { ShopByStitching } from '@/components/sections/ShopByStitching';
import { UspBar } from '@/components/sections/UspBar';
import { ProductCard, type ProductCardProps } from '@/components/commerce/ProductCard';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { listBrands, listCollections, listProducts } from '@/lib/catalog-client';
import { getHomeSections, getJournalPostsBySlugs } from '@/lib/content-client';
import {
  categoryGridVariant,
  inferCollectionRailSort,
  isHomeSectionType,
  parseHomeSections,
  pickLocale,
  type TypedHomeSection,
} from '@/lib/content-mappers';
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
 * Home — plan.md §15.2. Sections are now genuinely CMS-driven: `GET
 * /content/home` (`apps/api/src/modules/content`, see
 * `docs/implemented-plan.md` §4.7.3) returns the admin-configured, ordered,
 * in-active-window `home_sections` list, and `CmsHomeComposition` below
 * renders each one through the matching existing section component.
 * `lib/content-mappers.ts#parseHomeSections` validates each section's loose
 * `settings` record against its real typed schema (a malformed row is
 * skipped, logged, never a 500) and `lib/content-client.ts#getHomeSections`
 * does the actual fetch.
 *
 * **Fallback, explicit and documented**: no content editor may have built a
 * homepage yet — a real, expected state (`docs/implemented-plan.md` §4.7.3/
 * §6.8 both note this honestly), so a `GET /content/home` response with
 * zero sections, or one whose sections are all either invalid or the
 * R1-out-of-scope `journal_teaser` type, falls back to
 * `DefaultHomeComposition` — the exact fixed §15.2 launch order this file
 * rendered before this task, unchanged. This is not a silent behavior: the
 * page always renders one or the other branch below, on purpose.
 *
 * **The two catalogue-driven rails**: `CollectionRailSectionSettings`
 * (`packages/contracts/src/content.ts`) carries a `collectionId` for a
 * specific collection, or `null` to mean "derive it live" — but the real
 * settings shape has no field naming *which* `sort` a null-`collectionId`
 * rail wants (there's no such field in the contract; "New arrivals" and
 * "Best sellers" are both this exact section type). See
 * `content-mappers.ts#inferCollectionRailSort`'s doc comment for the
 * documented, `viewAllHref`-based rule used to tell them apart — the
 * underlying data source is still the same real `listProducts({ sort:
 * 'newest' | 'bestselling' })` call this page always used.
 *
 * `category_grid` sections dispatch between `ShopByStitching` and
 * `OccasionTiles` by tile count — see
 * `content-mappers.ts#categoryGridVariant`. `journal_teaser` sections now
 * render for real (plan.md §15.2 item 10 was R2-scoped only until the
 * `content` module's Lookbook/Journal storefront pages landed): each
 * section's `postSlugs` (`JournalTeaserSectionSettings`) is resolved to real,
 * published posts via `GET /content/journal?slugs=...`
 * (`lib/content-client.ts#getJournalPostsBySlugs`), which already drops any
 * unknown/draft slug and preserves the admin's own order — a section whose
 * slugs are empty, or none of which resolve, renders nothing (`JournalTeaser`
 * returns `null` for an empty `items` list), the same explicit,
 * documented-fallback spirit every other section on this page already
 * follows for its own empty-data case.
 */
export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  const rawSections = await getHomeSections();
  const typedSections = parseHomeSections(rawSections);

  if (typedSections.length === 0) {
    return <DefaultHomeComposition locale={locale} />;
  }

  return <CmsHomeComposition sections={typedSections} locale={locale} />;
}

// ---------------------------------------------------------------------------
// CMS-driven composition — real `home_sections`, real order.
// ---------------------------------------------------------------------------

async function CmsHomeComposition({ sections, locale }: { sections: TypedHomeSection[]; locale: AppLocale }) {
  const t = await getTranslations('home');

  const collectionRailSections = sections.filter(isHomeSectionType('collection_rail'));
  const journalTeaserSections = sections.filter(isHomeSectionType('journal_teaser'));
  // Only `collection_rail` needs brand data now — `brand_strip` itself is
  // never rendered (see the `case 'brand_strip'` removal note below).
  const needsBrands = collectionRailSections.length > 0;
  const needsCollectionLookup = collectionRailSections.some((section) => section.settings.collectionId !== null);
  // Deduped across every `journal_teaser` section on the page — one batch
  // call resolves every section's slugs at once; each section then looks its
  // own `postSlugs` up in the resulting map, so per-section order is never
  // lost even though the fetch itself is a single deduped union.
  const allJournalSlugs = Array.from(new Set(journalTeaserSections.flatMap((section) => section.settings.postSlugs)));

  const [brands, collections, journalPosts] = await Promise.all([
    needsBrands ? listBrands() : Promise.resolve([]),
    // A generous limit — resolving a CMS-referenced `collectionId` to its
    // slug (`listProducts` takes slugs, not ids, per `catalog-client.ts`'s
    // own doc comment) needs the full collection list, not just a first page.
    needsCollectionLookup ? listCollections(100) : Promise.resolve([]),
    allJournalSlugs.length > 0 ? getJournalPostsBySlugs(allJournalSlugs) : Promise.resolve([]),
  ]);
  const brandNameById = buildBrandNameById(brands);
  const collectionSlugById = new Map(collections.map((collection) => [collection.id, collection.slug]));
  const journalPostBySlug = new Map(journalPosts.map((post) => [post.slug, post]));

  const railItemsBySectionId = new Map<string, ProductCardProps[]>();
  await Promise.all(
    collectionRailSections.map(async (section) => {
      const slug = section.settings.collectionId ? collectionSlugById.get(section.settings.collectionId) : undefined;
      const result = slug
        ? await listProducts({ collection: slug, limit: section.settings.limit })
        : await listProducts({ sort: inferCollectionRailSort(section.settings.viewAllHref), limit: section.settings.limit });
      railItemsBySectionId.set(
        section.id,
        result.products.map((product) => toProductCardProps(product, brandNameById.get(product.brandId) ?? '', locale)),
      );
    }),
  );

  // Two adjacent sections never share a background (plan.md §13.5) — this
  // alternates paper/pearl across the section types that render as a plain
  // wrapped block (`collection_rail`, the grid variant of
  // `category_grid`). Types with their own inherent background (hero, the
  // panel variant of `category_grid`, video_banner, usp_bar, newsletter)
  // don't participate — they already visually differ from any neighbour.
  let bgToggle = 0;
  const nextBg = () => (bgToggle++ % 2 === 0 ? 'bg-paper' : 'bg-pearl');

  return (
    <>
      {sections.map((section) => {
        switch (section.type) {
          case 'hero':
            return <Hero key={section.id} settings={section.settings} locale={locale} />;

          case 'collection_rail': {
            const items = railItemsBySectionId.get(section.id) ?? [];
            if (items.length === 0) return null;
            const viewAllHref = section.settings.viewAllHref ?? undefined;
            return (
              <div key={section.id} className={`${nextBg()} py-[clamp(64px,9vw,160px)]`}>
                <CollectionRail
                  title={pickLocale(section.settings.titleEn, section.settings.titleAr, locale)}
                  items={items}
                  // `exactOptionalPropertyTypes` forbids passing an explicit
                  // `undefined` for an optional prop — spread it in only
                  // when there's a real value.
                  {...(viewAllHref ? { viewAllHref, viewAllLabel: t('collectionRail.viewAllGeneric') } : {})}
                />
              </div>
            );
          }

          case 'editorial_split':
            return (
              <div key={section.id} className={`${nextBg()} py-[clamp(64px,9vw,160px)]`}>
                <EditorialSplit settings={section.settings} locale={locale} />
              </div>
            );

          // `brand_strip` sections are never rendered — Lulwah Fashion sells
          // its own product, it isn't a multi-brand retailer, so a marquee
          // of "brands we carry" no longer describes anything real. See
          // `docs/adr/0001-remove-brand-listing.md`. The section TYPE stays
          // in the schema (an admin can no longer create one — see
          // `home-section-defaults.ts` — but a pre-existing document of this
          // type, if one is ever restored from a backup, degrades to
          // rendering nothing rather than a hard error), same "explicit,
          // documented no-op" treatment `default` below already gives any
          // section type this switch doesn't know.
          case 'category_grid': {
            const variant = categoryGridVariant(section.settings.tiles.length);
            if (variant === 'none') return null;
            const title = pickLocale(section.settings.titleEn, section.settings.titleAr, locale);
            if (variant === 'panels') {
              return <ShopByStitching key={section.id} tiles={section.settings.tiles} title={title} locale={locale} />;
            }
            return (
              <div key={section.id} className={`${nextBg()} py-[clamp(64px,9vw,160px)]`}>
                <OccasionTiles tiles={section.settings.tiles} title={title} locale={locale} />
              </div>
            );
          }

          case 'video_banner':
            return <FullBleedBreak key={section.id} settings={section.settings} locale={locale} />;

          case 'usp_bar':
            return <UspBar key={section.id} settings={section.settings} locale={locale} />;

          case 'newsletter':
            return <NewsletterSection key={section.id} settings={section.settings} locale={locale} />;

          case 'journal_teaser': {
            const items: JournalTeaserItem[] = section.settings.postSlugs
              .map((slug) => journalPostBySlug.get(slug))
              .filter((post): post is NonNullable<typeof post> => post !== undefined)
              .map((post) => {
                const postTitle = pickLocale(post.titleEn, post.titleAr, locale);
                return {
                  slug: post.slug,
                  title: postTitle,
                  excerpt: pickLocale(post.excerptEn, post.excerptAr, locale),
                  image: post.coverMedia ? { src: post.coverMedia.url, alt: postTitle } : null,
                };
              });
            if (items.length === 0) return null;
            return (
              <div key={section.id} className={`${nextBg()} py-[clamp(64px,9vw,160px)]`}>
                <JournalTeaser title={t('journalTeaser.title')} items={items} />
              </div>
            );
          }

          default:
            return null;
        }
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Default composition — the original fixed §15.2 launch order, used only
// when the CMS has nothing (renderable) configured yet. See this file's own
// top-level doc comment for exactly when this branch applies.
// ---------------------------------------------------------------------------

async function DefaultHomeComposition({ locale }: { locale: AppLocale }) {
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

      {/* 5. Brand strip — removed; Lulwah Fashion sells its own product, it
          isn't a multi-brand retailer. See
          `docs/adr/0001-remove-brand-listing.md`. */}

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

      {/* 11. Newsletter — item 10 "Journal teaser" has no fixed launch-order
          slot of its own in this fallback composition: it only ever renders
          from a real CMS section's own `postSlugs` (see `CmsHomeComposition`
          above), and this branch renders only when there is no usable CMS
          composition at all, so there are never any real slugs to show here. */}
      <NewsletterSection />
    </>
  );
}
