import { randomUUID } from 'node:crypto';
import type { ProductMediaItem } from '@lulwah/contracts';
import { notFoundError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as productRepo from './product.repository.js';
import { catalogEvents } from './catalog.events.js';
import { toProductDto } from './product.mapper.js';
import type { AddProductMediaInput } from './product.dto.js';

/**
 * `POST /admin/products/:id/media` — plan.md brief: "accept an
 * already-hosted URL for now — no real upload/S3 pipeline exists yet."
 * `publicId`/`width`/`height`/`dominantColor` are placeholder values since
 * there is no image-processing step to derive them from; a later media
 * pipeline can backfill them without changing this shape.
 */
export async function addProductMedia(actor: AuthenticatedUser, productId: string, input: AddProductMediaInput): Promise<ProductMediaItem[]> {
  assertPermission(actor, 'products.write');
  const product = await productRepo.findProductById(productId);
  if (!product) throw notFoundError('Product not found.');

  const newItem = {
    id: randomUUID(),
    type: input.type,
    publicId: randomUUID(),
    url: input.url,
    alt: input.alt,
    altAr: input.altAr,
    width: 0,
    height: 0,
    dominantColor: '#ffffff',
    sortOrder: product.media.length,
    isPrimary: input.isPrimary,
    variantId: null,
  };

  const media = input.isPrimary ? product.media.map((m) => ({ ...m, isPrimary: false })) : [...product.media];
  media.push(newItem);

  const updated = await productRepo.updateProduct(productId, { media });
  if (!updated) throw notFoundError('Product not found.');
  catalogEvents.publish('product.updated', { productId });
  return toProductDto(updated).media;
}
