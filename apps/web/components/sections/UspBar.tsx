import { getTranslations } from 'next-intl/server';

/**
 * "The Lulwah promise" — plan.md §15.2 item 9: text-only USP bar, label
 * type, hairline separators, **no icons** (§13.2 banned list: "Emoji as
 * icons; three-icon 'features' row" — instead "the USP bar is text-only,
 * uppercase, tracked").
 */
const ITEMS = ['authentic', 'delivery', 'returns', 'cod'] as const;

export async function UspBar() {
  const t = await getTranslations('home.usp');

  return (
    <section className="border-y border-line">
      <ul className="mx-auto flex max-w-[1600px] flex-col divide-y divide-line lg:flex-row lg:divide-x lg:divide-y-0">
        {ITEMS.map((key) => (
          <li key={key} className="flex-1 px-24 py-24 text-center lg:px-16">
            <p className="font-body text-label font-semibold tracking-label text-ink uppercase">{t(key)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
