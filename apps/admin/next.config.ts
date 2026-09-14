import type { NextConfig } from 'next';

/**
 * plan.md §11: `admin.lulwah.ae` is a separate, client-rendered Next.js app
 * with no SEO surface at all — every route must send `noindex, nofollow`,
 * not just carry a `<meta>` tag (crawlers that ignore markup still respect
 * headers). `output: 'standalone'` matches the Docker deployment shape used
 * across the monorepo (plan.md §36), even though this workstream doesn't
 * touch the Dockerfile itself.
 *
 * `transpilePackages` lets Next compile the workspace `@lulwah/*` packages
 * straight from source during `next dev`/`next build` instead of requiring
 * their `dist/` output to be pre-built and kept in sync — `tsc --noEmit`
 * (the `typecheck` script) still resolves their published `.d.ts` files, so
 * `pnpm -r build` is run once for those packages before typechecking.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@lulwah/ui', '@lulwah/tokens', '@lulwah/contracts', '@lulwah/utils'],
  // Same standalone-trace gap as apps/web/next.config.ts — see that
  // file's own comment (`outputFileTracingIncludes` was tried first and
  // didn't fix it; `serverExternalPackages` is the actual fix). This app
  // hit the identical container boot crash.
  serverExternalPackages: ['@swc/helpers'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
