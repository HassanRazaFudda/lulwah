import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * Home hero — plan.md §15.2 item 1 / §13.6's banned-list correction:
 * full-bleed image, type set off-axis (lower-start, inset from the
 * margin), a single text link — no centred headline-plus-two-pill-buttons.
 *
 * §13.7's WebGL "Dupatta" signature layer (vertex-shader cloth sim over
 * this hero) is R2-scoped and explicitly out of this workstream; per its
 * own spec it "falls back to a static campaign image + subtle CSS
 * parallax on low-end devices / prefers-reduced-motion" — this hero *is*
 * that static fallback, permanently, until the WebGL layer lands.
 */
export async function Hero() {
  const t = await getTranslations('home.hero');

  return (
    <section className="relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-zamurrad-deep">
      <Image
        src="/campaigns/lawn-26-vol1-hero.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-90"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-zamurrad-deep/80 via-zamurrad-deep/10 to-transparent" />

      <div className="relative flex h-full flex-col justify-end px-24 pb-64 lg:px-[clamp(24px,5vw,88px)] lg:pb-96">
        <p className="font-body text-label font-semibold tracking-label text-gold uppercase">{t('eyebrow')}</p>
        <h1 className="max-w-[16ch] font-display text-display-1 leading-[0.94] tracking-display text-paper">
          {t('title')}
        </h1>
        <Link
          href="/shop/new-in"
          className="mt-24 inline-block w-fit font-body text-body font-medium text-paper underline decoration-1 underline-offset-4 hover:decoration-2"
        >
          {t('cta')}
        </Link>
      </div>

      {/* Scroll cue — "the pearl", §13.7's micro-signature travels a gold hairline elsewhere on the site; here it's simply the resting mark. */}
      <div className="absolute inset-x-0 bottom-24 flex justify-center" aria-hidden="true">
        <span className="size-8 rounded-full bg-gold" />
      </div>
    </section>
  );
}
