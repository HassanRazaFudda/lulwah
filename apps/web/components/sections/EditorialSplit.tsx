import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { EditorialSplitSectionSettings } from '@lulwah/contracts';
import type { AppLocale } from '@/i18n/routing';
import { pickLocale } from '@/lib/content-mappers';
import { ContentLink } from './ContentLink';

export interface EditorialSplitProps {
  /** A CMS-configured `editorial_split` home section, when one exists.
   *  Omitted renders the original static Eid-edit copy/image. */
  settings?: EditorialSplitSectionSettings | null;
  locale?: AppLocale;
}

/**
 * plan.md §15.2 item 4: "3/2 asymmetric: campaign image + a short
 * paragraph about the collection, real copy, no marketing filler" — the
 * editorial 5-column grid variant from §13.5.
 */
export async function EditorialSplit({ settings, locale = 'en' }: EditorialSplitProps = {}) {
  const t = await getTranslations('home.editorial');

  const title = settings ? pickLocale(settings.titleEn, settings.titleAr, locale) : t('title');
  const body = settings ? pickLocale(settings.bodyEn, settings.bodyAr, locale) : t('body');
  const imageSrc = settings?.media?.url ?? '/campaigns/eid-edit-2026.jpg';
  const imageFirst = (settings?.mediaPosition ?? 'left') === 'left';
  // `EditorialSplitSectionSettings` carries a `linkHref` but no link-label
  // field of its own — the static fallback's translated "Read the edit"
  // copy only applies when there's no CMS section at all; a CMS-driven
  // section with a configured `linkHref` gets a generic, still-real (not
  // fabricated) label instead. `linkHref: null` means no link at all.
  const showCta = settings ? settings.linkHref !== null : true;
  const linkHref = settings?.linkHref ?? '/shop/eid';
  const ctaLabel = settings ? t('ctaGeneric') : t('cta');

  return (
    <section className="grid grid-cols-1 lg:grid-cols-5">
      <div
        className={`relative aspect-[4/5] lg:col-span-3 lg:aspect-auto ${imageFirst ? 'lg:order-1' : 'lg:order-2'}`}
      >
        <Image src={imageSrc} alt="" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
      </div>
      <div
        className={`flex flex-col justify-center gap-16 bg-pearl px-24 py-48 lg:col-span-2 lg:px-[clamp(24px,5vw,64px)] ${imageFirst ? 'lg:order-2' : 'lg:order-1'}`}
      >
        {!settings ? (
          <p className="font-body text-label font-semibold tracking-label text-mukaish uppercase">{t('eyebrow')}</p>
        ) : null}
        <h2 className="font-display text-display-2 tracking-display text-ink">{title}</h2>
        <p className="max-w-[48ch] font-body text-body text-ink-70">{body}</p>
        {showCta ? (
          <ContentLink
            href={linkHref}
            className="mt-8 inline-block w-fit font-body text-body font-medium text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
          >
            {ctaLabel}
          </ContentLink>
        ) : null}
      </div>
    </section>
  );
}
