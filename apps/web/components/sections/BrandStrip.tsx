import { getTranslations } from 'next-intl/server';
import type { Brand } from '@lulwah/contracts';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { BRANDS } from '@/lib/placeholder-data';

export interface BrandStripProps {
  /** Real `Brand` entities, already resolved from a CMS `brand_strip`
   *  section's `brandIds` (page.tsx does the id→entity lookup, the same
   *  role `product-mappers.ts#buildBrandNameById` already plays for product
   *  rails — a settings object alone can't render a brand name/slug/logo).
   *  Omitted renders the original static placeholder brand list; an empty
   *  array (an unconfigured section, or one whose referenced brands were
   *  since deleted) renders nothing — there's no honest real content to
   *  show for a genuinely empty section. */
  brands?: Brand[];
  locale?: AppLocale;
}

/**
 * plan.md §15.2 item 5 / §14.4: a slow marquee of brand wordmarks, pausing
 * on hover. The keyframes live in `styles/globals.css` (`@keyframes
 * marquee`); the list is duplicated once so translating by exactly -50%
 * produces a seamless loop with no JS.
 */
export async function BrandStrip({ brands, locale = 'en' }: BrandStripProps = {}) {
  const t = await getTranslations('home.brandStrip');

  if (brands && brands.length === 0) return null;

  const items = brands
    ? brands.map((brand) => ({
        key: brand.id,
        href: `/brands/${brand.slug}`,
        name: locale === 'ar' ? brand.nameAr : brand.name,
      }))
    : BRANDS.map((brand) => ({ key: brand.slug, href: `/brands/${brand.slug}`, name: brand.name }));
  const loopedItems = [...items, ...items];

  return (
    <section className="flex flex-col gap-24 overflow-hidden py-16">
      <h2 className="px-24 font-body text-label font-semibold tracking-label text-mukaish uppercase lg:px-[clamp(24px,5vw,88px)]">
        {t('title')}
      </h2>
      <div className="group overflow-hidden">
        <div className="flex w-max animate-[marquee_60s_linear_infinite] gap-64 group-hover:[animation-play-state:paused]">
          {loopedItems.map((item, index) => (
            <Link
              key={`${item.key}-${index}`}
              href={item.href}
              className="font-display text-heading-1 tracking-display whitespace-nowrap text-ink/70 transition-colors duration-base ease-out hover:text-ink"
            >
              {item.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
