/**
 * Custom `next/image` loader — plan.md §4.1 ("next/image with a custom
 * imgproxy loader — self-hosted transforms, AVIF/WebP, responsive srcset")
 * and §4.3 (imgproxy runs as its own container behind Cloudflare, never
 * behind the Next.js server itself).
 *
 * This builds an imgproxy "unsigned"/insecure-mode URL
 * (`/insecure/rs:fill:<width>:0/q:<quality>/plain/<source>`) rather than
 * calling a real service — the imgproxy container is a sibling
 * infrastructure workstream (§5.1) and is not wired up yet. Once it is,
 * swap `IMGPROXY_BASE_URL` for the real origin and this loader needs no
 * other changes.
 */
const IMGPROXY_BASE_URL = process.env.NEXT_PUBLIC_IMGPROXY_URL ?? 'https://images.lulwahfashion.com';
const DEFAULT_QUALITY = 80;

export interface ImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

export default function imgproxyLoader({ src, width, quality }: ImageLoaderParams): string {
  // No imgproxy container runs in local dev (docker-compose.dev.yml
  // deliberately doesn't include one -- see plan.md §25.1, only
  // mongo/redis/meilisearch run there). Routing every image, including
  // plain /public assets, through a hardcoded imgproxy origin that
  // doesn't exist would make every image permanently broken in dev with
  // no way to preview the storefront. Serve local assets directly
  // instead; production sets NEXT_PUBLIC_IMGPROXY_URL for real and gets
  // the real transform pipeline.
  if (!process.env.NEXT_PUBLIC_IMGPROXY_URL) {
    // `?w=` is inert against Next's static file server (no resizing
    // happens), but its presence keeps the URL width-dependent, which
    // is what silences next/image's "loader doesn't implement width"
    // dev warning -- otherwise every request the same width-invariant
    // src, which is exactly what that check flags.
    return `${src}?w=${width}`;
  }

  // Already-absolute URLs (e.g. a CDN URL from seed/placeholder data) are
  // passed straight to imgproxy as the "plain" source; local/public assets
  // resolve against the app's own origin at request time.
  const resolvedQuality = quality ?? DEFAULT_QUALITY;
  const options = `rs:fill:${width}:0:0/q:${resolvedQuality}`;
  return `${IMGPROXY_BASE_URL}/insecure/${options}/plain/${encodeURIComponent(src)}`;
}
