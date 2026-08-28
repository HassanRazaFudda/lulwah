import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { CategoryGridTile } from '@lulwah/contracts';
import type { AppLocale } from '@/i18n/routing';
import { pickLocale } from '@/lib/content-mappers';
import { ContentLink } from './ContentLink';

/** plan.md §15.2 item 8: "Everyday / Eid / Mehndi / Barat / Walima, five tiles in the 5-column editorial grid." */
const TILES = [
  { key: 'everyday', href: '/shop/everyday', image: '/campaigns/occasion-everyday.jpg' },
  { key: 'eid', href: '/shop/eid', image: '/campaigns/occasion-eid.jpg' },
  { key: 'mehndi', href: '/shop/mehndi', image: '/campaigns/occasion-mehndi.jpg' },
  { key: 'barat', href: '/shop/barat', image: '/campaigns/occasion-barat.jpg' },
  { key: 'walima', href: '/shop/walima', image: '/campaigns/occasion-walima.jpg' },
] as const;

export interface OccasionTilesProps {
  /** A CMS `category_grid` section's tiles, when this section is the
   *  grid-style rendering of that type (4+ tiles — see
   *  `lib/content-mappers.ts#categoryGridVariant`). Omitted renders the
   *  original static five-occasion grid below. */
  tiles?: CategoryGridTile[];
  title?: string;
  locale?: AppLocale;
}

/**
 * The other of the two existing renderers for the CMS's `category_grid`
 * section type (the other is `ShopByStitching`) — see
 * `content-mappers.ts#categoryGridVariant`'s doc comment for why one
 * settings shape maps to two different layouts.
 */
export async function OccasionTiles({ tiles, title, locale = 'en' }: OccasionTilesProps = {}) {
  const t = await getTranslations('home.occasion');
  const heading = title ?? t('title');

  const items = tiles
    ? tiles.map((tile, index) => ({
        key: `${index}`,
        href: tile.href,
        image: tile.image?.url ?? '/catalogue/placeholder.svg',
        label: pickLocale(tile.labelEn, tile.labelAr, locale),
      }))
    : TILES.map((tile) => ({ key: tile.key, href: tile.href, image: tile.image, label: t(`tiles.${tile.key}`) }));

  return (
    <section className="flex flex-col gap-24 px-24 lg:px-[clamp(24px,5vw,88px)]">
      <h2 className="font-display text-heading-1 tracking-display text-ink">{heading}</h2>
      <div className="grid grid-cols-2 gap-16 lg:grid-cols-5">
        {items.map((tile) => (
          <ContentLink key={tile.key} href={tile.href} className="group relative aspect-[3/4] overflow-hidden bg-pearl">
            <Image
              src={tile.image}
              alt=""
              fill
              sizes="(min-width: 1024px) 20vw, 50vw"
              className="object-cover transition-transform duration-slow ease-cloth group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-ink/25" />
            <span className="absolute inset-x-0 bottom-16 text-center font-body text-label font-semibold tracking-label text-paper uppercase">
              {tile.label}
            </span>
          </ContentLink>
        ))}
      </div>
    </section>
  );
}
