import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { CategoryGridTile } from '@lulwah/contracts';
import type { AppLocale } from '@/i18n/routing';
import { pickLocale } from '@/lib/content-mappers';
import { ContentLink } from './ContentLink';

const PANELS = [
  { key: 'unstitched', href: '/shop/unstitched', image: '/campaigns/panel-unstitched.jpg' },
  { key: 'pret', href: '/shop/pret', image: '/campaigns/panel-pret.jpg' },
  { key: 'formal', href: '/shop/formal-wedding', image: '/campaigns/panel-formal.jpg' },
] as const;

export interface ShopByStitchingProps {
  /** A CMS `category_grid` section's tiles, when this section is the
   *  panel-style rendering of that type (1–3 tiles — see
   *  `lib/content-mappers.ts#categoryGridVariant`). Omitted renders the
   *  original static three-panel taxonomy below. */
  tiles?: CategoryGridTile[];
  title?: string;
  locale?: AppLocale;
}

/**
 * plan.md §15.2 item 3: "three full-height panels: Unstitched · Ready to
 * Wear · Formal & Wedding. Hover reveals the fabric macro behind the
 * label... the store's core navigation idea." This is the taxonomy from
 * §2.1 made into primary navigation, not a generic Dresses/Tops/Bottoms
 * rail. Also doubles as one of the two existing renderers for the CMS's
 * `category_grid` section type (the other is `OccasionTiles`) — see
 * `content-mappers.ts#categoryGridVariant`'s doc comment for why one
 * settings shape maps to two different layouts.
 */
export async function ShopByStitching({ tiles, title, locale = 'en' }: ShopByStitchingProps = {}) {
  const t = await getTranslations('home.shopByStitching');
  const heading = title ?? t('title');

  // `CategoryGridTile` (packages/contracts/src/content.ts) carries no
  // description field — the hover-reveal paragraph below only exists for
  // the static fallback panels, never fabricated for CMS-driven tiles.
  const panels = tiles
    ? tiles.map((tile, index) => ({
        key: `${index}`,
        href: tile.href,
        image: tile.image?.url ?? '/catalogue/placeholder.svg',
        label: pickLocale(tile.labelEn, tile.labelAr, locale),
        description: null as string | null,
      }))
    : PANELS.map((panel) => ({
        key: panel.key,
        href: panel.href,
        image: panel.image,
        label: t(`${panel.key}.title`),
        description: t(`${panel.key}.description`),
      }));

  return (
    <section className="bg-paper">
      <h2 className="sr-only">{heading}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {panels.map((panel) => (
          <ContentLink
            key={panel.key}
            href={panel.href}
            className="group relative flex h-[70vh] min-h-[420px] items-end overflow-hidden lg:h-[82vh]"
          >
            <Image
              src={panel.image}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, 100vw"
              className="object-cover transition-transform duration-slow ease-cloth group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-ink/40 transition-colors duration-base ease-out group-hover:bg-ink/15" />
            <div className="relative flex w-full flex-col gap-8 p-24 lg:p-32">
              <h3 className="font-display text-display-2 tracking-display text-paper">{panel.label}</h3>
              {panel.description ? (
                <p
                  className={
                    'max-w-[32ch] font-body text-body text-paper/90 opacity-0 transition-opacity duration-base ease-out group-hover:opacity-100'
                  }
                >
                  {panel.description}
                </p>
              ) : null}
            </div>
          </ContentLink>
        ))}
      </div>
    </section>
  );
}
