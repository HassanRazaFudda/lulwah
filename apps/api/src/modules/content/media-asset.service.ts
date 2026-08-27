import { randomUUID } from 'node:crypto';
import type { MediaAsset } from '@lulwah/contracts';
import { notFoundError, validationError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as repo from './media-asset.repository.js';
import type { MediaAssetListFilter } from './media-asset.repository.js';
import { toMediaAssetDto } from './media-asset.mapper.js';
import type { AdminCreateMediaAssetInput, AdminUpdateMediaAssetInput, BulkUpdateMediaAssetsInput } from './media-asset.dto.js';

/**
 * plan.md §11.1: "Media library with folders, search, alt-text bulk edit."
 * Per this phase's own brief: check whether P1's product-image path already
 * has a reusable upload abstraction before building a new one. It doesn't
 * — `catalog/media.service.ts#addProductMedia`'s own doc comment says
 * plainly "accept an already-hosted URL for now — no real upload/S3
 * pipeline exists yet", and nothing else in this codebase uploads/stores
 * binary files anywhere (confirmed: no S3/Cloudinary/multer/sharp
 * dependency exists in `apps/api/package.json`). So this is honestly a
 * **metadata layer over paste-a-URL assets** — folders, alt text (EN/AR),
 * tags, search — not a new asset-storage system; `width`/`height`/`bytes`/
 * `dominantColor` are caller-supplied or left `null`, same as
 * `addProductMedia`'s identical placeholders for the identical reason.
 */
export async function adminListMediaAssets(
  actor: AuthenticatedUser,
  filter: MediaAssetListFilter,
  page: number,
  limit: number,
): Promise<{ assets: MediaAsset[]; total: number }> {
  assertPermission(actor, 'content.read');
  const { assets, total } = await repo.listMediaAssets(filter, page, limit);
  return { assets: assets.map(toMediaAssetDto), total };
}

export async function adminListFolders(actor: AuthenticatedUser): Promise<string[]> {
  assertPermission(actor, 'content.read');
  return repo.listDistinctFolders();
}

export async function adminGetMediaAsset(actor: AuthenticatedUser, id: string): Promise<MediaAsset> {
  assertPermission(actor, 'content.read');
  const doc = await repo.findMediaAssetById(id);
  if (!doc) throw notFoundError('Media asset not found.');
  return toMediaAssetDto(doc);
}

export async function createMediaAsset(actor: AuthenticatedUser, input: AdminCreateMediaAssetInput): Promise<MediaAsset> {
  assertPermission(actor, 'content.write');
  const doc = await repo.createMediaAsset({ ...input, publicId: randomUUID(), uploadedBy: actor.id });
  return toMediaAssetDto(doc);
}

export async function updateMediaAsset(actor: AuthenticatedUser, id: string, input: AdminUpdateMediaAssetInput): Promise<MediaAsset> {
  assertPermission(actor, 'content.write');
  const doc = await repo.updateMediaAsset(id, input);
  if (!doc) throw notFoundError('Media asset not found.');
  return toMediaAssetDto(doc);
}

/** Bulk alt-text edit (plan.md §11.1) — every `id` must resolve to a real,
 *  non-deleted asset or the whole batch is rejected (never a silent
 *  partial write the caller has to diff against what they sent). */
export async function bulkUpdateMediaAssets(actor: AuthenticatedUser, input: BulkUpdateMediaAssetsInput): Promise<MediaAsset[]> {
  assertPermission(actor, 'content.write');
  const ids = input.updates.map((u) => u.id);
  const existing = await repo.findMediaAssetsByIds(ids);
  const existingIds = new Set(existing.map((doc) => doc._id.toString()));
  const missing = ids.filter((id) => !existingIds.has(id));
  if (missing.length > 0) {
    throw validationError('One or more media asset ids were not found.', 'updates', { missingIds: missing });
  }

  await repo.bulkUpdateMediaAssets(
    input.updates.map(({ id, ...changes }) => ({ id, changes })),
  );
  const updated = await repo.findMediaAssetsByIds(ids);
  return updated.map(toMediaAssetDto);
}

export async function deleteMediaAsset(actor: AuthenticatedUser, id: string): Promise<void> {
  assertPermission(actor, 'content.write');
  const deleted = await repo.softDeleteMediaAsset(id);
  if (!deleted) throw notFoundError('Media asset not found.');
}
