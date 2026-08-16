import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Archivo } from 'next/font/google';
import { buildColorCss } from '@lulwah/tokens';
import { Providers } from '../components/Providers';
import './globals.css';

/**
 * plan.md §11: admin.lulwah.ae is a dense, fast internal tool — Archivo
 * only, never the storefront's Bodoni Moda display face (that is its
 * editorial signature, deliberately not reused here, per §13.4/§11).
 * `next/font/google` self-hosts the variable font at build time (no
 * runtime Google Fonts request, no CLS) since this workstream has no local
 * WOFF2 asset files to point `next/font/local` at the way the storefront's
 * font pipeline eventually will. `archivo.className` is applied directly
 * to `<body>` rather than through Tailwind's `font-body` utility: Next
 * generates a scoped internal font-family name, which the shared
 * `@lulwah/config/tailwind-preset`'s literal `"Archivo"` family string
 * (shared with the storefront) would not match — this app simply never
 * reaches for `font-display`/`font-body` and relies on inheritance instead.
 */
const archivo = Archivo({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Lulwah Admin',
  description: 'Internal admin console for Lulwah Fashion.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Static, build-time token CSS (packages/tokens) — no user input. */}
        <style dangerouslySetInnerHTML={{ __html: buildColorCss() }} />
      </head>
      <body className={`${archivo.className} bg-paper text-body text-ink antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
