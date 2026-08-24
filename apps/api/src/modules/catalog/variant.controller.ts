import type { Request, Response } from 'express';
import { objectId } from '@lulwah/contracts';
import { sendSuccess } from '../../shared/response.js';
import { requireAuthedUser } from './catalog.controller-utils.js';
import * as variantService from './variant.service.js';
import * as mediaService from './media.service.js';
import { AdminCreateVariantInput, AdminUpdateVariantInput, AddProductMediaInput } from './product.dto.js';

/** `POST|PATCH|DELETE /admin/products/:id/variants[/:variantId]` and
 *  `POST /admin/products/:id/media` — plan.md §9.7. */

export async function create(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const productId = objectId.parse(req.params.id);
  const input = AdminCreateVariantInput.parse(req.body);
  const variant = await variantService.createVariant(actor, productId, input);
  sendSuccess(res, { variant }, undefined, 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const productId = objectId.parse(req.params.id);
  const variantId = objectId.parse(req.params.variantId);
  const input = AdminUpdateVariantInput.parse(req.body);
  const variant = await variantService.updateVariant(actor, productId, variantId, input);
  sendSuccess(res, { variant });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const productId = objectId.parse(req.params.id);
  const variantId = objectId.parse(req.params.variantId);
  await variantService.deleteVariant(actor, productId, variantId);
  sendSuccess(res, {});
}

export async function addMedia(req: Request, res: Response): Promise<void> {
  const actor = requireAuthedUser(req);
  const productId = objectId.parse(req.params.id);
  const input = AddProductMediaInput.parse(req.body);
  const media = await mediaService.addProductMedia(actor, productId, input);
  sendSuccess(res, { media }, undefined, 201);
}
