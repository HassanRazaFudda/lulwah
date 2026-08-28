import { getTranslations } from 'next-intl/server';
import type { NewsletterSectionSettings } from '@lulwah/contracts';
import type { AppLocale } from '@/i18n/routing';
import { pickLocale } from '@/lib/content-mappers';
import { NewsletterForm } from './NewsletterForm';

export interface NewsletterSectionProps {
  /** A CMS `newsletter` home section, when one exists. Omitted renders the
   *  original static headline/subtitle. */
  settings?: NewsletterSectionSettings | null;
  locale?: AppLocale;
}

/** plan.md §15.2 item 11: "emerald panel, one field, consent checkbox." */
export async function NewsletterSection({ settings, locale = 'en' }: NewsletterSectionProps = {}) {
  const t = await getTranslations('home.newsletterSection');

  const title = settings ? pickLocale(settings.headlineEn, settings.headlineAr, locale) : t('title');
  // `subtextEn`/`subtextAr` default to `''` in the real contract (an admin
  // can genuinely leave it blank) — fall back to the static subtitle copy
  // per-field, not just per-section, rather than rendering an empty line.
  const configuredSubtitle = settings ? pickLocale(settings.subtextEn, settings.subtextAr, locale) : '';
  const subtitle = configuredSubtitle || t('subtitle');

  return (
    <section className="bg-zamurrad px-24 py-64 lg:px-[clamp(24px,5vw,88px)] lg:py-96">
      <div className="mx-auto flex max-w-[640px] flex-col items-center gap-16 text-center">
        <h2 className="font-display text-display-2 tracking-display text-paper">{title}</h2>
        <p className="font-body text-body text-paper/80">{subtitle}</p>
        <NewsletterForm variant="panel" className="w-full max-w-[440px] text-start" />
      </div>
    </section>
  );
}
