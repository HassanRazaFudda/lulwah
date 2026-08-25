import { slugify } from '@lulwah/utils';
import type { Product } from '@lulwah/contracts';
import { AppError, notFoundError } from '../../shared/errors.js';
import { assertPermission } from '../identity/identity.policy.js';
import type { AuthenticatedUser } from '../identity/identity.policy.js';
import * as brandRepo from './brand.repository.js';
import * as categoryRepo from './category.repository.js';
import * as collectionRepo from './collection.repository.js';
import * as productRepo from './product.repository.js';
import type { ProductListFilter, ProductSort } from './product.repository.js';
import * as variantRepo from './variant.repository.js';
import { catalogEvents } from './catalog.events.js';
import { toBrandDto } from './brand.mapper.js';
import { toProductDto, toVariantDto } from './product.mapper.js';
import { computePriceDisplay } from './price.util.js';
import type { AdminCreateProductInput, AdminUpdateProductInput, Breadcrumb, ListProductsQuery, VariantWithAvailability } from './product.dto.js';
// Read-only cross-module call through `inventory`'s exported service
// interface, per plan.md §5.3 — never its repository or model directly.
import { getInventoryForVariants } from '../inventory/inventory.service.js';

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

async function resolveSlugId(kind: 'category' | 'brand' | 'collection', slug: string | undefined): Promise<string | undefined> {
  if (!slug) return undefined;
  if (kind === 'category') return (await categoryRepo.findCategoryBySlug(slug))?._id.toString();
  if (kind === 'brand') return (await brandRepo.findBrandBySlug(slug))?._id.toString();
  return (await collectionRepo.findCollectionBySlug(slug))?._id.toString();
}

/** plan.md §9.2 `GET /products` — public listing, always `status: active`. */
export async function listProducts(query: ListProductsQuery): Promise<{ products: Product[]; total: number }> {
  const [categoryId, brandId, resolvedCollectionId] = await Promise.all([
    resolveSlugId('category', query.category),
    resolveSlugId('brand', query.brand),
    resolveSlugId('collection', query.collection),
  ]);

  const productIdsIn = query.size ? await variantRepo.findProductIdsBySize(query.size) : undefined;
  if (query.size && productIdsIn?.length === 0) return { products: [], total: 0 };

  const filter: ProductListFilter = {
    status: 'active',
    ...(categoryId ? { categoryId } : {}),
    ...(brandId ? { brandId } : {}),
    ...(resolvedCollectionId ? { collectionId: resolvedCollectionId } : {}),
    ...(query.stitchingType ? { stitchingType: query.stitchingType } : {}),
    ...(query.fabric ? { fabric: query.fabric } : {}),
    ...(query.work ? { work: query.work } : {}),
    ...(query.occasion ? { occasion: query.occasion } : {}),
    ...(query.colorFamily ? { colorFamily: query.colorFamily } : {}),
    ...(productIdsIn ? { productIdsIn } : {}),
    ...(query.minPrice !== undefined ? { minPriceFils: query.minPrice } : {}),
    ...(query.maxPrice !== undefined ? { maxPriceFils: query.maxPrice } : {}),
    ...(query.inStock !== undefined ? { inStock: query.inStock } : {}),
    ...(query.onSale !== undefined ? { onSale: query.onSale } : {}),
  };
  const { products, total } = await productRepo.listProducts(filter, query.sort as ProductSort, query.page, query.limit);
  return { products: products.map(toProductDto), total };
}

export async function adminListProducts(
  actor: AuthenticatedUser,
  query: ListProductsQuery & { status?: Product['status'] | undefined },
): Promise<{ products: Product[]; total: number }> {
  assertPermission(actor, 'products.read');
  const filter: ProductListFilter = { ...(query.status ? { status: query.status } : {}) };
  const { products, total } = await productRepo.listProducts(filter, query.sort as ProductSort, query.page, query.limit);
  return { products: products.map(toProductDto), total };
}

async function buildBreadcrumbs(primaryCategoryId: string): Promise<Breadcrumb[]> {
  const trail: Breadcrumb[] = [];
  let current = await categoryRepo.findCategoryById(primaryCategoryId);
  while (current) {
    trail.unshift({ name: current.name, slug: current.slug });
    current = current.parentId ? await categoryRepo.findCategoryById(current.parentId.toString()) : null;
  }
  return trail;
}

/** plan.md §9.2 `GET /products/:slug` — "full PDP payload: product +
 *  variants + inventory availability + breadcrumbs". */
export async function getProductDetailBySlug(slug: string): Promise<{
  product: Product;
  brand: ReturnType<typeof toBrandDto>;
  variants: VariantWithAvailability[];
  breadcrumbs: Breadcrumb[];
}> {
  const productDoc = await productRepo.findProductBySlug(slug);
  if (!productDoc) throw notFoundError('Product not found.');

  const [brandDoc, variantDocs, breadcrumbs] = await Promise.all([
    brandRepo.findBrandById(productDoc.brandId.toString()),
    variantRepo.findVariantsByProductId(productDoc._id.toString()),
    buildBreadcrumbs(productDoc.primaryCategoryId.toString()),
  ]);
  if (!brandDoc) throw notFoundError('Brand not found.');

  const inventoryItems = await getInventoryForVariants(variantDocs.map((v) => v._id.toString()));
  const inventoryByVariantId = new Map(inventoryItems.map((item) => [item.variantId, item]));

  const variants: VariantWithAvailability[] = variantDocs
    .filter((v) => v.isActive)
    .map((v) => {
      const inv = inventoryByVariantId.get(v._id.toString());
      return { ...toVariantDto(v), available: inv?.available ?? 0, allowBackorder: inv?.allowBackorder ?? false };
    });

  return { product: toProductDto(productDoc), brand: toBrandDto(brandDoc), variants, breadcrumbs };
}

export async function getRelatedProducts(slug: string, limit: number): Promise<Product[]> {
  const productDoc = await productRepo.findProductBySlug(slug);
  if (!productDoc) throw notFoundError('Product not found.');
  const related = await productRepo.findRelatedProducts(productDoc, limit);
  return related.map(toProductDto);
}

export async function getProductByIdAdmin(actor: AuthenticatedUser, id: string): Promise<Product> {
  assertPermission(actor, 'products.read');
  const doc = await productRepo.findProductById(id);
  if (!doc) throw notFoundError('Product not found.');
  return toProductDto(doc);
}

/**
 * Read-only, no RBAC — for other modules' cross-module calls through
 * `catalog`'s exported service interface (plan.md §5.3), never its
 * repository/model directly. `cart` uses this to snapshot a line's current
 * price/status; `pricing`'s discount engine wrapper uses it to resolve a
 * discount's product/category/brand/collection eligibility. Same pattern
 * as `inventory.service.ts#getInventoryForVariants` — a plain internal
 * read, not a public HTTP-facing endpoint.
 */
export async function getProductsByIds(ids: readonly string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const docs = await productRepo.findProductsByIds(ids);
  return docs.map(toProductDto);
}

export async function getProductById(id: string): Promise<Product | null> {
  const doc = await productRepo.findProductById(id);
  return doc ? toProductDto(doc) : null;
}

/** Fires the events the sibling Meilisearch-sync job listens for (plan.md
 *  §5.3). Both event names get the same handler treatment on the
 *  subscriber side (re-read the product, upsert-or-remove based on its
 *  current status) — see `catalog.events.ts`'s doc comment — so which one
 *  fires only matters for the event log's own semantics: `published` the
 *  first time a product becomes `active`, `updated` on every change after. */
function emitProductChangeEvent(productId: string, previousStatus: Product['status'] | null, nextStatus: Product['status']): void {
  if (nextStatus === 'active' && previousStatus !== 'active') {
    catalogEvents.publish('product.published', { productId });
  } else {
    catalogEvents.publish('product.updated', { productId });
  }
}

export async function createProduct(actor: AuthenticatedUser, input: AdminCreateProductInput): Promise<Product> {
  assertPermission(actor, 'products.write');
  const slug = input.slug ?? slugify(input.title);
  const { effectivePriceFils, discountPercent } = computePriceDisplay(input.basePriceFils, input.compareAtPriceFils);

  try {
    const doc = await productRepo.createProduct({
      ...input,
      slug,
      articleCode: input.articleCode.toUpperCase(),
      hasVariants: false,
      variantAxes: [],
      priceRange: { minFils: input.basePriceFils, maxFils: input.basePriceFils },
      effectivePriceFils,
      discountPercent,
      inStock: false,
      totalStock: 0,
      media: [],
    });
    emitProductChangeEvent(doc._id.toString(), null, doc.status);
    return toProductDto(doc);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError('CONFLICT', 409, { messageEn: 'A product with this slug or article code already exists.', field: 'slug' });
    }
    throw err;
  }
}

export async function updateProduct(actor: AuthenticatedUser, id: string, input: AdminUpdateProductInput): Promise<Product> {
  assertPermission(actor, 'products.write');
  const existing = await productRepo.findProductById(id);
  if (!existing) throw notFoundError('Product not found.');

  const nextBasePriceFils = input.basePriceFils ?? existing.basePriceFils;
  const nextCompareAtPriceFils = input.compareAtPriceFils !== undefined ? input.compareAtPriceFils : existing.compareAtPriceFils;
  const { effectivePriceFils, discountPercent } = computePriceDisplay(nextBasePriceFils, nextCompareAtPriceFils);

  try {
    const updated = await productRepo.updateProduct(id, {
      ...input,
      ...(input.articleCode ? { articleCode: input.articleCode.toUpperCase() } : {}),
      effectivePriceFils,
      discountPercent,
    });
    if (!updated) throw notFoundError('Product not found.');
    emitProductChangeEvent(id, existing.status, updated.status);
    return toProductDto(updated);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError('CONFLICT', 409, { messageEn: 'A product with this slug or article code already exists.', field: 'slug' });
    }
    throw err;
  }
}

export async function deleteProduct(actor: AuthenticatedUser, id: string): Promise<void> {
  assertPermission(actor, 'products.write');
  const existing = await productRepo.findProductById(id);
  if (!existing) throw notFoundError('Product not found.');
  const deleted = await productRepo.softDeleteProduct(id);
  if (!deleted) throw notFoundError('Product not found.');
  emitProductChangeEvent(id, existing.status, 'archived');
}

/**
 * Exported for `inventory.service.ts` to call after every stock change —
 * the module-boundary-respecting path plan.md's brief describes ("update
 * the parent Product's denormalized inStock/totalStock fields"). `catalog`
 * never reaches into `InventoryItem` directly; `inventory` never reaches
 * into `Product` directly. Each side only calls the other's exported
 * service function (plan.md §5.3).
 */
export async function applyProductStockDelta(productId: string, deltaTotalStock: number): Promise<void> {
  await productRepo.applyStockDelta(productId, deltaTotalStock);
}

/** Recomputes `priceRange` from the product's own active variants — called
 *  by `variant.service.ts` after any variant create/update/delete that
 *  could move the min/max (plan.md §7.5: "recomputed on write"). Falls
 *  back to the product's own `basePriceFils` when it has no variants yet. */
export async function recomputePriceRange(productId: string): Promise<void> {
  const prices = await variantRepo.findActiveVariantPrices(productId);
  if (prices.length === 0) {
    const product = await productRepo.findProductById(productId);
    if (!product) return;
    await productRepo.updatePriceRange(productId, { minFils: product.basePriceFils, maxFils: product.basePriceFils });
    return;
  }
  const values = prices.map((p) => p.priceFils);
  await productRepo.updatePriceRange(productId, { minFils: Math.min(...values), maxFils: Math.max(...values) });
}
