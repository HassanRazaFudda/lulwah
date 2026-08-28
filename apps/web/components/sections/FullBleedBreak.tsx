import Image from 'next/image';
import type { VideoBannerSectionSettings } from '@lulwah/contracts';
import type { AppLocale } from '@/i18n/routing';
import { pickLocale } from '@/lib/content-mappers';

export interface FullBleedBreakProps {
  /** A CMS `video_banner` home section, when one exists — the closest (and
   *  only) existing renderer for that content type. Omitted renders the
   *  original static fabric macro image. */
  settings?: VideoBannerSectionSettings | null;
  locale?: AppLocale;
}

/**
 * plan.md §15.2 item 7: "a single fabric macro image, no text, pure
 * rhythm." Maps the CMS's `video_banner` section type — despite the name,
 * nothing in this codebase plays video anywhere on the storefront yet, so
 * `settings.videoUrl` is deliberately not rendered here (an honest scope
 * limit, not an oversight); only the still `media` and an optional caption
 * are wired through.
 */
export function FullBleedBreak({ settings, locale = 'en' }: FullBleedBreakProps = {}) {
  const imageSrc = settings?.media?.url ?? '/campaigns/fabric-macro-jamawar.jpg';
  const caption = settings ? pickLocale(settings.captionEn, settings.captionAr, locale) : '';

  return (
    <section className="relative h-[50vh] min-h-[320px] w-full lg:h-[70vh]" aria-hidden={caption ? undefined : true}>
      <Image src={imageSrc} alt="" fill sizes="100vw" className="object-cover" />
      {caption ? (
        <span className="absolute inset-x-0 bottom-24 text-center font-body text-label font-semibold tracking-label text-paper uppercase">
          {caption}
        </span>
      ) : null}
    </section>
  );
}
