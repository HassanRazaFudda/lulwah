import { Schema } from 'mongoose';

/**
 * A local copy of `catalog/brand.model.ts`'s `MediaRefSubdoc`/`mediaRefSchema`
 * — same rationale `content/media-ref.schema.ts` already documents: the
 * module-boundary lint rule (`eslint.config.js`) forbids importing another
 * module's `*.model.ts` file even for a plain type, so every module that
 * embeds a `MediaRef` (here: `Review.media[]`) inlines its own identical
 * copy rather than reaching into `catalog`/`content`.
 */
export interface MediaRefSubdoc {
  publicId: string;
  url: string;
  width: number | null;
  height: number | null;
}

export const mediaRefSchema = new Schema<MediaRefSubdoc>(
  { publicId: { type: String, required: true }, url: { type: String, required: true }, width: { type: Number, default: null }, height: { type: Number, default: null } },
  { _id: false },
);
