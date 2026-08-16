import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/**
 * plan.md §4.1 / §4.3: images are transformed by a self-hosted imgproxy
 * container behind Cloudflare, not Vercel's managed image API — Vercel
 * isn't part of this stack (§4.3, self-hosted on one Contabo VPS). Setting
 * `loader: 'custom'` disables `next/image`'s built-in optimizer and routes
 * every image through `lib/image-loader.ts`, which builds an imgproxy URL.
 * `output: 'standalone'` per §4.3: images are built in CI and pulled by
 * the VPS, never built on the server itself.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
  },
};

export default withNextIntl(nextConfig);
