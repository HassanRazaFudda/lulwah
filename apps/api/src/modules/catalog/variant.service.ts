import type { Variant } from '@lulwah/contracts';
import { AppError, notFoundError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as productRepo from './product.repository.js';
import * as variantRepo from './variant.repository.js';
import { catalogEvents } from './catalog.events.js';
import { toProductDto, toAdminVariantDto } from './product.mapper.js';
import { recomputePriceRange } from './product.service.js';
import type { AdminCreateVariantInput, AdminProductDetailResponse, AdminUpdateVariantInput } from './product.dto.js';
import * as inventoryService from '../inventory/inventory.service.js';

function isDuplicateSkuError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

async function requireProduct(productId: string) {
  const product = await productRepo.findProductById(productId);
  if (!product) throw notFoundError('Product not found.');
  return product;
}

async function afterVariantChange(productId: string): Promise<void> {
  await recomputePriceRange(productId);
  // A variant's price/SKU/availability is part of what the search index
  // shows for its product (plan.md §7.14's filterable/sortable price
  // attributes) — reindex on every variant mutation, not just product edits.
  catalogEvents.publish('product.updated', { productId });
}

/** `GET /admin/products/:id` — product + its variants merged with live
 *  stock, for the admin product editor (plan.md §9.7). */
export async function getAdminProductDetail(actor: AuthenticatedUser, productId: string): Promise<AdminProductDetailResponse> {
  assertPermission(actor, 'products.read');
  const product = await requireProduct(productId);
  const variantDocs = await variantRepo.findVariantsByProductId(productId);
  const inventoryItems = await inventoryService.getInventoryForVariants(variantDocs.map((v) => v._id.toString()));
  const inventoryByVariantId = new Map(inventoryItems.map((item) => [item.variantId, item]));

  const variants = variantDocs.map((v) => {
    const inv = inventoryByVariantId.get(v._id.toString());
    return { ...toAdminVariantDto(v), onHand: inv?.onHand ?? 0, available: inv?.available ?? 0, allowBackorder: inv?.allowBackorder ?? false };
  });
  return { product: toProductDto(product), variants };
}

export async function createVariant(actor: AuthenticatedUser, productId: string, input: AdminCreateVariantInput): Promise<Variant> {
  assertPermission(actor, 'products.write');
  const product = await requireProduct(productId);

  let variantDoc;
  try {
    variantDoc = await variantRepo.createVariant({
      productId: product._id,
      sku: input.sku.toUpperCase(),
      barcode: input.barcode,
      options: input.options,
      priceFils: input.priceFils,
      compareAtPriceFils: input.compareAtPriceFils,
      costPriceFils: input.costPriceFils,
      weightGrams: input.weightGrams,
      mediaIds: input.mediaIds,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    });
  } catch (err) {
    if (isDuplicateSkuError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A variant with this SKU already exists.', field: 'sku' });
    throw err;
  }

  await inventoryService.ensureInventoryItem({
    variantId: variantDoc._id.toString(),
    productId: product._id.toString(),
    sku: variantDoc.sku,
    onHand: input.initialOnHand,
  });

  // Once a product has any real variant, its listing price/facets derive
  // from variants, not the flat product-level fallback (plan.md §7.5:
  // "basePriceFils: fallback if no variants").
  await productRepo.updateProduct(productId, { hasVariants: true });
  await afterVariantChange(productId);
  return toAdminVariantDto(variantDoc);
}

export async function updateVariant(actor: AuthenticatedUser, productId: string, variantId: string, input: AdminUpdateVariantInput): Promise<Variant> {
  assertPermission(actor, 'products.write');
  await requireProduct(productId);
  const existing = await variantRepo.findVariantById(variantId);
  if (!existing || existing.productId.toString() !== productId) throw notFoundError('Variant not found.');

  try {
    const updated = await variantRepo.updateVariant(variantId, { ...input, ...(input.sku ? { sku: input.sku.toUpperCase() } : {}) });
    if (!updated) throw notFoundError('Variant not found.');
    await afterVariantChange(productId);
    return toAdminVariantDto(updated);
  } catch (err) {
    if (isDuplicateSkuError(err)) throw new AppError('CONFLICT', 409, { messageEn: 'A variant with this SKU already exists.', field: 'sku' });
    throw err;
  }
}

export async function deleteVariant(actor: AuthenticatedUser, productId: string, variantId: string): Promise<void> {
  assertPermission(actor, 'products.write');
  await requireProduct(productId);
  const existing = await variantRepo.findVariantById(variantId);
  if (!existing || existing.productId.toString() !== productId) throw notFoundError('Variant not found.');

  await inventoryService.deleteInventoryItem(variantId);
  await variantRepo.softDeleteVariant(variantId);

  const remaining = await variantRepo.countVariantsForProduct(productId);
  if (remaining === 0) await productRepo.updateProduct(productId, { hasVariants: false });
  await afterVariantChange(productId);
}
