import { getTranslations } from 'next-intl/server';
import type { UspBarSectionSettings } from '@lulwah/contracts';
import type { AppLocale } from '@/i18n/routing';

/**
 * "The Lulwah promise" — plan.md §15.2 item 9: text-only USP bar, label
 * type, hairline separators, **no icons** (§13.2 banned list: "Emoji as
 * icons; three-icon 'features' row" — instead "the USP bar is text-only,
 * uppercase, tracked").
 */
const DEFAULT_ITEMS = ['authentic', 'delivery', 'returns', 'cod'] as const;

export interface UspBarProps {
  /** A CMS `usp_bar` home section, when one exists. Omitted (or configured
   *  with an empty items list for the current locale) renders the original
   *  static four-item promise bar. */
  settings?: UspBarSectionSettings | null;
  locale?: AppLocale;
}

export async function UspBar({ settings, locale = 'en' }: UspBarProps = {}) {
  const t = await getTranslations('home.usp');
  const defaults = DEFAULT_ITEMS.map((key) => t(key));
  const configured = settings ? (locale === 'ar' ? settings.itemsAr : settings.itemsEn) : [];
  const lines = configured.length > 0 ? configured : defaults;

  return (
    <section className="border-y border-line">
      <ul className="mx-auto flex max-w-[1600px] flex-col divide-y divide-line lg:flex-row lg:divide-x lg:divide-y-0">
        {lines.map((line, index) => (
          <li key={index} className="flex-1 px-24 py-24 text-center lg:px-16">
            <p className="font-body text-label font-semibold tracking-label text-ink uppercase">{line}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
