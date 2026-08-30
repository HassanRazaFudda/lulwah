import type { MediaRef } from '@lulwah/contracts';
import type { MediaRefSubdoc } from './media-ref.schema.js';

/**
 * A local copy of `content/media-ref.mapper.ts`'s `toMediaRefDto`/
 * `toMediaRefSubdoc` — same rationale as `media-ref.schema.ts`: the module
 * layering (plan.md §5.3) treats another module's mapper as an internal
 * implementation detail, not an exported service call, so `engagement`
 * duplicates this tiny pure function rather than reaching into `content`/
 * `catalog` for it.
 */
export function toMediaRefDto(subdoc: MediaRefSubdoc): MediaRef {
  return {
    publicId: subdoc.publicId,
    url: subdoc.url,
    ...(subdoc.width !== null ? { width: subdoc.width } : {}),
    ...(subdoc.height !== null ? { height: subdoc.height } : {}),
  };
}

export function toMediaRefSubdoc(ref: MediaRef): MediaRefSubdoc {
  return { publicId: ref.publicId, url: ref.url, width: ref.width ?? null, height: ref.height ?? null };
}
