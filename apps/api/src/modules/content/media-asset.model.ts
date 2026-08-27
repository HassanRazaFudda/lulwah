import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * Mongoose schema for `media` (the media library) — plan.md §7.13:
 * "publicId, url, type, width, height, bytes, alt, altAr, folder, tags[],
 * dominantColor, uploadedBy". `content` owns this model (plan.md §5.3);
 * only `media-asset.repository.ts` may import it (§5.4).
 *
 * A metadata layer over already-hosted URLs, deliberately — see this
 * module's own doc comment (`content.routes.ts`) for why: no real
 * upload/S3/imgproxy pipeline exists anywhere in this codebase to extend
 * (`catalog/media.service.ts`'s own doc comment says as much for product
 * media), so `width`/`height`/`bytes`/`dominantColor` stay caller-supplied
 * or `null`, never derived from a real image-processing step.
 */

export type MediaAssetType = 'image' | 'video';

export interface MediaAssetDoc {
  _id: Types.ObjectId;
  publicId: string;
  url: string;
  type: MediaAssetType;
  width: number | null;
  height: number | null;
  bytes: number | null;
  alt: string;
  altAr: string;
  folder: string;
  tags: string[];
  dominantColor: string | null;
  uploadedBy: Types.ObjectId | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const mediaAssetSchema = new Schema<MediaAssetDoc>(
  {
    publicId: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'], required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    bytes: { type: Number, default: null },
    alt: { type: String, default: '' },
    altAr: { type: String, default: '' },
    folder: { type: String, default: '', trim: true },
    tags: { type: [String], default: [] },
    dominantColor: { type: String, default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'media' },
);

mediaAssetSchema.index({ publicId: 1 }, { unique: true });
mediaAssetSchema.index({ deletedAt: 1, folder: 1, createdAt: -1 });
mediaAssetSchema.index({ tags: 1 });

export type MediaAssetHydratedDoc = HydratedDocument<MediaAssetDoc>;
export const MediaAssetModel = model<MediaAssetDoc>('MediaAsset', mediaAssetSchema);
