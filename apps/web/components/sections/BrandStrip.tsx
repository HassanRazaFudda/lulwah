import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { BRANDS } from '@/lib/placeholder-data';

/**
 * plan.md §15.2 item 5 / §14.4: a slow marquee of brand wordmarks, pausing
 * on hover. The keyframes live in `styles/globals.css` (`@keyframes
 * marquee`); the list is duplicated once so translating by exactly -50%
 * produces a seamless loop with no JS.
 */
export async function BrandStrip() {
  const t = await getTranslations('home.brandStrip');
  const loopedBrands = [...BRANDS, ...BRANDS];

  return (
    <section className="flex flex-col gap-24 overflow-hidden py-16">
      <h2 className="px-24 font-body text-label font-semibold tracking-label text-mukaish uppercase lg:px-[clamp(24px,5vw,88px)]">
        {t('title')}
      </h2>
      <div className="group overflow-hidden">
        <div className="flex w-max animate-[marquee_60s_linear_infinite] gap-64 group-hover:[animation-play-state:paused]">
          {loopedBrands.map((brand, index) => (
            <Link
              key={`${brand.slug}-${index}`}
              href={`/brands/${brand.slug}`}
              className="font-display text-heading-1 tracking-display whitespace-nowrap text-ink/70 transition-colors duration-base ease-out hover:text-ink"
            >
              {brand.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
