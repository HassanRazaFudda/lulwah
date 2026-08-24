import type { MediaRef } from '@lulwah/contracts';
import type { MediaRefSubdoc } from './brand.model.js';

/**
 * `MediaRefSubdoc` (Mongoose: `width`/`height` are `number | null`, always
 * present) → `@lulwah/contracts`' `MediaRef` (`width`/`height` are
 * `.optional()`, i.e. the key itself may be entirely absent). Shared by
 * every mapper with a logo/cover/hero/category image field, since
 * `exactOptionalPropertyTypes` (plan.md §27.1) treats `{ width: undefined }`
 * and "no `width` key at all" as different types.
 */
export function toMediaRefDto(subdoc: MediaRefSubdoc | null): MediaRef | null {
  if (!subdoc) return null;
  return {
    publicId: subdoc.publicId,
    url: subdoc.url,
    ...(subdoc.width !== null ? { width: subdoc.width } : {}),
    ...(subdoc.height !== null ? { height: subdoc.height } : {}),
  };
}

/** The reverse direction — an admin DTO's `MediaRef` (optional
 *  width/height key) → the exact shape Mongoose's `MediaRefSubdoc`
 *  requires (`width`/`height` always present, `number | null`). Used by
 *  every `*.repository.ts` create/update function that writes a
 *  logo/cover/hero/category image, so the input type stays the DTO's own
 *  shape at the service-layer boundary while what actually reaches
 *  Mongoose matches its schema exactly. */
export function toMediaRefSubdoc(ref: MediaRef | null | undefined): MediaRefSubdoc | null {
  if (!ref) return null;
  return { publicId: ref.publicId, url: ref.url, width: ref.width ?? null, height: ref.height ?? null };
}
