import { getTranslations } from 'next-intl/server';
import { NewsletterForm } from './NewsletterForm';

/** plan.md §15.2 item 11: "emerald panel, one field, consent checkbox." */
export async function NewsletterSection() {
  const t = await getTranslations('home.newsletterSection');

  return (
    <section className="bg-zamurrad px-24 py-64 lg:px-[clamp(24px,5vw,88px)] lg:py-96">
      <div className="mx-auto flex max-w-[640px] flex-col items-center gap-16 text-center">
        <h2 className="font-display text-display-2 tracking-display text-paper">{t('title')}</h2>
        <p className="font-body text-body text-paper/80">{t('subtitle')}</p>
        <NewsletterForm variant="panel" className="w-full max-w-[440px] text-start" />
      </div>
    </section>
  );
}
