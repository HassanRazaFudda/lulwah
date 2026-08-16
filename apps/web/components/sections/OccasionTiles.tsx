import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** plan.md §15.2 item 8: "Everyday / Eid / Mehndi / Barat / Walima, five tiles in the 5-column editorial grid." */
const TILES = [
  { key: 'everyday', href: '/shop/everyday', image: '/campaigns/occasion-everyday.jpg' },
  { key: 'eid', href: '/shop/eid', image: '/campaigns/occasion-eid.jpg' },
  { key: 'mehndi', href: '/shop/mehndi', image: '/campaigns/occasion-mehndi.jpg' },
  { key: 'barat', href: '/shop/barat', image: '/campaigns/occasion-barat.jpg' },
  { key: 'walima', href: '/shop/walima', image: '/campaigns/occasion-walima.jpg' },
] as const;

export async function OccasionTiles() {
  const t = await getTranslations('home.occasion');

  return (
    <section className="flex flex-col gap-24 px-24 lg:px-[clamp(24px,5vw,88px)]">
      <h2 className="font-display text-heading-1 tracking-display text-ink">{t('title')}</h2>
      <div className="grid grid-cols-2 gap-16 lg:grid-cols-5">
        {TILES.map((tile) => (
          <Link key={tile.key} href={tile.href} className="group relative aspect-[3/4] overflow-hidden bg-pearl">
            <Image
              src={tile.image}
              alt=""
              fill
              sizes="(min-width: 1024px) 20vw, 50vw"
              className="object-cover transition-transform duration-slow ease-cloth group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-ink/25" />
            <span className="absolute inset-x-0 bottom-16 text-center font-body text-label font-semibold tracking-label text-paper uppercase">
              {t(`tiles.${tile.key}`)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
