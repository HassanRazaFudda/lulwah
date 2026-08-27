import type { MediaAsset } from '@lulwah/contracts';
import type { MediaAssetDoc, MediaAssetHydratedDoc } from './media-asset.model.js';

export function toMediaAssetDto(doc: MediaAssetDoc | MediaAssetHydratedDoc): MediaAsset {
  return {
    id: doc._id.toString(),
    publicId: doc.publicId,
    url: doc.url,
    type: doc.type,
    width: doc.width,
    height: doc.height,
    bytes: doc.bytes,
    alt: doc.alt,
    altAr: doc.altAr,
    folder: doc.folder,
    tags: doc.tags,
    dominantColor: doc.dominantColor,
    uploadedBy: doc.uploadedBy ? doc.uploadedBy.toString() : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
