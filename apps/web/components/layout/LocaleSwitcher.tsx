'use client';

import { useLocale } from 'next-intl';
import { cx } from '@lulwah/ui';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

const LOCALE_LABELS: Record<(typeof routing.locales)[number], string> = {
  en: 'EN',
  ar: 'ع',
};

/** plan.md §15.1 footer: "language switcher." Swaps `/en` <-> `/ar` while staying on the same page. */
export function LocaleSwitcher() {
  const activeLocale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-12" aria-label="Language">
      {routing.locales.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={locale === activeLocale}
          onClick={() => router.replace(pathname, { locale })}
          aria-current={locale === activeLocale ? 'true' : undefined}
          className={cx(
            'font-body text-label font-semibold tracking-label uppercase',
            locale === activeLocale ? 'text-gold' : 'text-paper/60 hover:text-paper',
          )}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
