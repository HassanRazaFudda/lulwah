import { Schema } from 'mongoose';

/**
 * A local copy of `catalog/brand.model.ts`'s `MediaRefSubdoc`/`mediaRefSchema`
 * — every entity in `catalog` that embeds a `MediaRef` (brand, category,
 * collection) already inlines its own identical copy of this rather than
 * import one another's, since the module-boundary lint rule (`eslint.config.js`)
 * forbids importing another module's `*.model.ts` file even for a plain
 * type. `content` follows the same established precedent instead of adding
 * a cross-module exception.
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
