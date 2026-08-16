import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * plan.md §15.2 item 4: "3/2 asymmetric: campaign image + a short
 * paragraph about the collection, real copy, no marketing filler" — the
 * editorial 5-column grid variant from §13.5.
 */
export async function EditorialSplit() {
  const t = await getTranslations('home.editorial');

  return (
    <section className="grid grid-cols-1 lg:grid-cols-5">
      <div className="relative aspect-[4/5] lg:col-span-3 lg:aspect-auto">
        <Image
          src="/campaigns/eid-edit-2026.jpg"
          alt=""
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col justify-center gap-16 bg-pearl px-24 py-48 lg:col-span-2 lg:px-[clamp(24px,5vw,64px)]">
        <p className="font-body text-label font-semibold tracking-label text-mukaish uppercase">{t('eyebrow')}</p>
        <h2 className="font-display text-display-2 tracking-display text-ink">{t('title')}</h2>
        <p className="max-w-[48ch] font-body text-body text-ink-70">{t('body')}</p>
        <Link
          href="/shop/eid"
          className="mt-8 inline-block w-fit font-body text-body font-medium text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
        >
          {t('cta')}
        </Link>
      </div>
    </section>
  );
}
