import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * plan.md §15.2 item 3: "three full-height panels: Unstitched · Ready to
 * Wear · Formal & Wedding. Hover reveals the fabric macro behind the
 * label... the store's core navigation idea." This is the taxonomy from
 * §2.1 made into primary navigation, not a generic Dresses/Tops/Bottoms
 * rail.
 */
const PANELS = [
  { key: 'unstitched', href: '/shop/unstitched', image: '/campaigns/panel-unstitched.jpg' },
  { key: 'pret', href: '/shop/pret', image: '/campaigns/panel-pret.jpg' },
  { key: 'formal', href: '/shop/formal-wedding', image: '/campaigns/panel-formal.jpg' },
] as const;

export async function ShopByStitching() {
  const t = await getTranslations('home.shopByStitching');

  return (
    <section className="bg-paper">
      <h2 className="sr-only">{t('title')}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {PANELS.map((panel) => (
          <Link
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
              <h3 className="font-display text-display-2 tracking-display text-paper">{t(`${panel.key}.title`)}</h3>
              <p
                className={
                  'max-w-[32ch] font-body text-body text-paper/90 opacity-0 transition-opacity duration-base ease-out group-hover:opacity-100'
                }
              >
                {t(`${panel.key}.description`)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
