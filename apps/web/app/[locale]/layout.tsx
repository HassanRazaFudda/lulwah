import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import localFont from 'next/font/local';
import { notFound } from 'next/navigation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { cx } from '@lulwah/ui';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { routing } from '@/i18n/routing';
import '@/styles/globals.css';

/**
 * Self-hosted fonts via `next/font/local` — plan.md §4.1 ("self-hosted via
 * next/font/local, WOFF2, subset; no render-blocking Google Fonts request;
 * no CLS") and §13.4. Each is loaded in `variable` mode so it only
 * contributes a scoped CSS custom property to `<html>`; `styles/globals.css`
 * is what actually wires `font-display`/`font-body`/etc. to these
 * variables (see the comment at the top of that file for why).
 *
 * The four woff2 files under `./fonts` are real, self-hosted, correctly
 * licensed webfont subsets (sourced from the Fontsource mirrors of Bodoni
 * Moda, Archivo, Aref Ruqaa and IBM Plex Sans Arabic — all are open-licensed
 * Google Fonts), not placeholder/fake binaries — see the root task report
 * for the one deliberate simplification: these are each a single
 * "standard" instance (variable `wght`, and `wdth` for Archivo) rather
 * than exposing every variable axis the plan mentions (e.g. Bodoni Moda's
 * `opsz` axis is fixed at its default optical size here, not user-variable).
 */
const bodoniModa = localFont({
  src: './fonts/bodoni-moda-variable.woff2',
  variable: '--font-bodoni-moda',
  weight: '400 900',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

const archivo = localFont({
  src: './fonts/archivo-variable.woff2',
  variable: '--font-archivo',
  weight: '100 900',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

const arefRuqaa = localFont({
  src: './fonts/aref-ruqaa-arabic-400.woff2',
  variable: '--font-aref-ruqaa',
  weight: '400',
  display: 'swap',
  fallback: ['Traditional Arabic', 'serif'],
});

const ibmPlexArabic = localFont({
  src: [
    { path: './fonts/ibm-plex-sans-arabic-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans-arabic-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-ibm-plex-arabic',
  display: 'swap',
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    title: { default: t('defaultTitle'), template: t('titleTemplate') },
    description: t('description'),
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lulwahfashion.com'),
    alternates: {
      languages: { en: '/en', ar: '/ar' },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // Enables static rendering for this locale (next-intl App Router pattern) — §12.2's ISR strategy relies on it.
  setRequestLocale(locale);

  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const isArabic = locale === 'ar';

  return (
    <html
      lang={locale}
      dir={dir}
      className={cx(bodoniModa.variable, archivo.variable, arefRuqaa.variable, ibmPlexArabic.variable)}
    >
      <body className={cx('bg-paper text-ink', isArabic ? 'font-body-ar' : 'font-body')}>
        <NuqsAdapter>
          <NextIntlClientProvider messages={messages}>
            <QueryProvider>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:start-16 focus:top-16 focus:z-50 focus:bg-paper focus:px-16 focus:py-8 focus:text-ink"
              >
                Skip to content
              </a>
              <AnnouncementBar />
              <Header />
              <main id="main-content">{children}</main>
              <Footer />
            </QueryProvider>
          </NextIntlClientProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
