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
  // `output: 'standalone'`'s own file tracer doesn't correctly copy
  // `@swc/helpers` for this pnpm workspace — found live, container-tested
  // through several attempts: the module is correctly installed and
  // linked (a workspace-wide `pnpm.overrides` entry, pnpm-workspace.yaml,
  // forces one deduplicated copy even Next's own internal require-hook
  // can find), but the container still crashed on boot with `Cannot find
  // module '.../@swc/helpers/esm/_interop_require_default.js'` — the
  // trace had only copied the package's `cjs/` half, not `esm/`, because
  // Next's bundler inlines its CJS usage but Node's own internal ESM
  // `exports`-map resolution (triggered by `next/dist/server/require-
  // hook.js` at runtime, invisible to static tracing) separately needs
  // the `esm/` half too. `outputFileTracingIncludes` (tried first) didn't
  // fix it either — same partial copy. `serverExternalPackages` is the
  // actual fix: it opts this package OUT of bundling entirely, so it's
  // resolved at runtime via Node's own ordinary `require()`/`exports`
  // lookup against the real, whole, on-disk package directory instead of
  // whatever subset the bundler's static analysis decided was "used".
  serverExternalPackages: ['@swc/helpers'],
};

export default withNextIntl(nextConfig);
