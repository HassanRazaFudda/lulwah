import { z } from 'zod';
import { MediaAsset, MediaAssetType, objectId } from '@lulwah/contracts';

/**
 * plan.md §11.1: "Media library with folders, search, alt-text bulk edit."
 * `AdminCreateMediaAssetInput` accepts an already-hosted URL, same
 * "paste-a-URL for now" precedent `catalog/product.dto.ts#AddProductMediaInput`
 * sets — see `media-asset.service.ts`'s doc comment.
 */
export const AdminCreateMediaAssetInput = z.object({
  url: z.string().min(1),
  type: MediaAssetType.default('image'),
  width: z.number().int().nonnegative().nullable().default(null),
  height: z.number().int().nonnegative().nullable().default(null),
  bytes: z.number().int().nonnegative().nullable().default(null),
  alt: z.string().default(''),
  altAr: z.string().default(''),
  folder: z.string().default(''),
  tags: z.array(z.string()).default([]),
  dominantColor: z.string().nullable().default(null),
});
export type AdminCreateMediaAssetInput = z.infer<typeof AdminCreateMediaAssetInput>;

export const AdminUpdateMediaAssetInput = z.object({
  alt: z.string().optional(),
  altAr: z.string().optional(),
  folder: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type AdminUpdateMediaAssetInput = z.infer<typeof AdminUpdateMediaAssetInput>;

/** "alt-text bulk edit" — one round trip for N assets, each independently
 *  addressed by id. Folder/tags are included too since a bulk-organize
 *  action (move a batch into a folder, tag a batch) is the same shape of
 *  operation, not a separate endpoint. */
export const BulkUpdateMediaAssetsInput = z.object({
  updates: z
    .array(
      z.object({
        id: objectId,
        alt: z.string().optional(),
        altAr: z.string().optional(),
        folder: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .min(1)
    .max(200),
});
export type BulkUpdateMediaAssetsInput = z.infer<typeof BulkUpdateMediaAssetsInput>;

export const AdminListMediaAssetsQuery = z.object({
  folder: z.string().optional(),
  search: z.string().optional(),
  tag: z.string().optional(),
  type: MediaAssetType.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
export type AdminListMediaAssetsQuery = z.infer<typeof AdminListMediaAssetsQuery>;

export const AdminMediaAssetListResponse = z.object({ assets: z.array(MediaAsset) });
export type AdminMediaAssetListResponse = z.infer<typeof AdminMediaAssetListResponse>;

export const AdminMediaAssetResponse = z.object({ asset: MediaAsset });
export type AdminMediaAssetResponse = z.infer<typeof AdminMediaAssetResponse>;

export const BulkUpdateMediaAssetsResponse = z.object({ assets: z.array(MediaAsset) });
export type BulkUpdateMediaAssetsResponse = z.infer<typeof BulkUpdateMediaAssetsResponse>;

export const MediaFoldersResponse = z.object({ folders: z.array(z.string()) });
export type MediaFoldersResponse = z.infer<typeof MediaFoldersResponse>;
