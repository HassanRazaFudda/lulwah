import { slugify } from '@lulwah/utils';
import type { Collection } from '@lulwah/contracts';
import { AppError, notFoundError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as repo from './collection.repository.js';
import * as productRepo from './product.repository.js';
import { toCollectionDto } from './collection.mapper.js';
import { buildAutomatedProductFilter } from './collection.rules.js';
import { catalogEvents } from './catalog.events.js';
import type { AdminCreateCollectionInput, AdminUpdateCollectionInput } from './collection.dto.js';
import type { CollectionHydratedDoc } from './collection.model.js';

function isDuplicateSlugError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

/** How many products an automated collection resolves to at most — a
 *  sensible display cap (matches the PLP's own page-size ballpark), not a
 *  hard product-catalog limit. */
const AUTOMATED_COLLECTION_MAX_PRODUCTS = 200;

/** `type: 'automated'` collections don't store a curated `productIds` —
 *  membership is computed live from `rules[]` every time the collection is
 *  read, via the exact same facet-filter machinery `GET /products` uses
 *  (`collection.rules.ts`). Manual collections just return their stored,
 *  drag-ordered array unchanged. */
async function resolveCollectionDto(doc: CollectionHydratedDoc): Promise<Collection> {
  const dto = toCollectionDto(doc);
  if (doc.type !== 'automated') return dto;
  const filter = buildAutomatedProductFilter(doc.rules);
  const { products } = await productRepo.listProducts(filter, 'newest', 1, AUTOMATED_COLLECTION_MAX_PRODUCTS);
  return { ...dto, productIds: products.map((p) => p._id.toString()) };
}

/** plan.md §9.2 `GET /collections` — public listing, always `status: active`. */
export async function listPublicCollections(page: number, limit: number): Promise<{ collections: Collection[]; total: number }> {
  const { collections, total } = await repo.listCollections({ status: 'active' }, page, limit);
  return { collections: collections.map(toCollectionDto), total };
}

export async function getCollectionBySlug(slug: string): Promise<Collection> {
  const doc = await repo.findCollectionBySlug(slug);
  if (!doc || doc.status === 'draft') throw notFoundError('Collection not found.');
  return resolveCollectionDto(doc);
}

export async function adminListCollections(
  actor: AuthenticatedUser,
  status: Collection['status'] | undefined,
  page: number,
  limit: number,
): Promise<{ collections: Collection[]; total: number }> {
  assertPermission(actor, 'products.read');
  const { collections, total } = await repo.listCollections(status ? { status } : {}, page, limit);
  return { collections: collections.map(toCollectionDto), total };
}

export async function adminGetCollection(actor: AuthenticatedUser, id: string): Promise<Collection> {
  assertPermission(actor, 'products.read');
  const doc = await repo.findCollectionById(id);
  if (!doc) throw notFoundError('Collection not found.');
  return resolveCollectionDto(doc);
}

/** Fires `collection.launched` (plan.md §5.3) the moment a collection's
 *  status becomes `active` — on creation directly as `active`, or on a
 *  later admin edit that flips it from `draft`/`scheduled`. */
function emitLaunchEventIfNeeded(collectionId: string, previousStatus: Collection['status'] | null, nextStatus: Collection['status']): void {
  if (nextStatus === 'active' && previousStatus !== 'active') {
    catalogEvents.publish('collection.launched', { collectionId });
  }
}

export async function createCollection(actor: AuthenticatedUser, input: AdminCreateCollectionInput): Promise<Collection> {
  assertPermission(actor, 'products.write');
  try {
    const doc = await repo.createCollection({ ...input, slug: input.slug ?? slugify(input.name) });
    emitLaunchEventIfNeeded(doc._id.toString(), null, doc.status);
    return toCollectionDto(doc);
  } catch (err) {
    if (isDuplicateSlugError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A collection with this slug already exists.', field: 'slug' });
    throw err;
  }
}

export async function updateCollection(actor: AuthenticatedUser, id: string, input: AdminUpdateCollectionInput): Promise<Collection> {
  assertPermission(actor, 'products.write');
  const existing = await repo.findCollectionById(id);
  if (!existing) throw notFoundError('Collection not found.');

  try {
    const doc = await repo.updateCollection(id, input);
    if (!doc) throw notFoundError('Collection not found.');
    emitLaunchEventIfNeeded(id, existing.status, doc.status);
    return toCollectionDto(doc);
  } catch (err) {
    if (isDuplicateSlugError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A collection with this slug already exists.', field: 'slug' });
    throw err;
  }
}

export async function deleteCollection(actor: AuthenticatedUser, id: string): Promise<void> {
  assertPermission(actor, 'products.write');
  const deleted = await repo.softDeleteCollection(id);
  if (!deleted) throw notFoundError('Collection not found.');
}
