import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { PRODUCTS } from '@/lib/placeholder-data';

/** plan.md §17: "Rendering | ISR/SSG on every indexable route" and hreflang per page (§17). */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lulwahfashion.com';

const STATIC_PATHS = [
  '',
  '/shop/unstitched',
  '/shop/pret',
  '/shop/formal-wedding',
  '/collections',
  '/about',
  '/faq',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: `${SITE_URL}/${locale}${path}`,
        lastModified: new Date(),
        changeFrequency: path === '' ? 'daily' : 'weekly',
        priority: path === '' ? 1 : 0.7,
      });
    }
    for (const product of PRODUCTS) {
      entries.push({
        url: `${SITE_URL}/${locale}/product/${product.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
      });
    }
  }

  return entries;
}
