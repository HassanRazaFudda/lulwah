import type { Banner, PublicBanner } from '@lulwah/contracts';
import { notFoundError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as repo from './banner.repository.js';
import { toBannerDto, toPublicBannerDto } from './banner.mapper.js';
import { contentEvents } from './content.events.js';
import type { AdminCreateBannerInput, AdminUpdateBannerInput } from './banner.dto.js';

export async function adminListBanners(actor: AuthenticatedUser, placement: Banner['placement'] | undefined): Promise<Banner[]> {
  assertPermission(actor, 'content.read');
  const docs = await repo.listBanners(placement);
  return docs.map(toBannerDto);
}

export async function adminGetBanner(actor: AuthenticatedUser, id: string): Promise<Banner> {
  assertPermission(actor, 'content.read');
  const doc = await repo.findBannerById(id);
  if (!doc) throw notFoundError('Banner not found.');
  return toBannerDto(doc);
}

export async function createBanner(actor: AuthenticatedUser, input: AdminCreateBannerInput): Promise<Banner> {
  assertPermission(actor, 'content.write');
  const doc = await repo.createBanner(input);
  contentEvents.publish('banner.updated', { bannerId: doc._id.toString() });
  return toBannerDto(doc);
}

export async function updateBanner(actor: AuthenticatedUser, id: string, input: AdminUpdateBannerInput): Promise<Banner> {
  assertPermission(actor, 'content.write');
  const doc = await repo.updateBanner(id, input);
  if (!doc) throw notFoundError('Banner not found.');
  contentEvents.publish('banner.updated', { bannerId: id });
  return toBannerDto(doc);
}

export async function deleteBanner(actor: AuthenticatedUser, id: string): Promise<void> {
  assertPermission(actor, 'content.write');
  const deleted = await repo.softDeleteBanner(id);
  if (!deleted) throw notFoundError('Banner not found.');
  contentEvents.publish('banner.updated', { bannerId: id });
}

/** `GET /content/banners` — active, in-window banners, optionally filtered
 *  to one placement. No admin fields on the wire (see `PublicBanner`). */
export async function listPublicBanners(placement: Banner['placement'] | undefined): Promise<PublicBanner[]> {
  const docs = await repo.listPublishedBanners(placement, new Date());
  return docs.map(toPublicBannerDto);
}
