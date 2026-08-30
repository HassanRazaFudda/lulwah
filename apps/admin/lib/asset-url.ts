/**
 * Every `MediaRef`/`MediaAsset` URL this app stores (`/campaigns/...`,
 * `/catalogue/...`) is written as a path relative to `apps/web`'s own
 * origin, since that's the app whose `public/` folder actually holds these
 * files and whose pages are what these URLs are meant to render correctly
 * on. `apps/admin` runs as a separate app on its own origin (`next dev -p
 * 3001` vs. `apps/web`'s `-p 3000`) with no matching `public/` folder of
 * its own, so resolving one of these paths against *this* app's origin —
 * which is what a plain `<img src="/campaigns/...">` does by default — 404s
 * here even though the identical URL renders fine on the storefront.
 *
 * Found live, reported by the user: images visible on the storefront
 * weren't showing up in any of `apps/admin`'s own image previews (Products
 * list thumbnail, Content's Media Library grid, the Banners/Home
 * sections/Menu media-picker thumbnail, the product editor's Media tab).
 *
 * Resolves a stored asset URL to something this app's own origin can
 * actually fetch: a relative path gets `NEXT_PUBLIC_SITE_URL` prefixed
 * (defaulting to `apps/web`'s own dev port, matching the `API_BASE_URL`
 * fallback precedent in `api-client.ts`); an already-absolute URL (a real
 * CDN/imgproxy origin in a future deployment) is left untouched.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export function resolveAssetUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${SITE_URL}${url}`;
}
