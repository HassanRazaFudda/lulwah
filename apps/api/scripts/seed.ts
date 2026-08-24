/**
 * `pnpm seed` — plan.md §28's P1 next-step, built for real (this file was
 * previously a documented stub — see `docs/implemented-plan.md` §4.3).
 *
 * Seeds, in order: the locked §7.4 category tree, the 6 brands already
 * referenced in `apps/web/lib/placeholder-data.ts`, 30+ realistic Pakistani-
 * fashion products with variants and real inventory rows, and 2–3
 * collections. A `super_admin` user is seeded too (upserted, not
 * duplicated) so there's a way into `/admin/*` on a fresh environment.
 *
 * Idempotent: catalog/inventory collections are cleared and fully
 * reseeded on every run — simpler and less error-prone than upserting 30+
 * products field-by-field, and the brief explicitly allows either
 * approach ("clear and reseed, or upsert by slug/articleCode").
 *
 * Runs through the same `catalog`/`inventory` *service* functions the
 * admin HTTP API uses (`product.service.createProduct`,
 * `variant.service.createVariant`, `inventory.service.adjustStock`, …),
 * not raw model writes — so every computed field (slug, priceRange,
 * effectivePriceFils, totalStock, inStock) comes out exactly as it would
 * from a real admin session, and a couple of variants' stock arrives via a
 * genuine `StockMovement` rather than only the initial-onHand shortcut.
 */
import argon2 from 'argon2';
import { Types } from 'mongoose';
import { slugify } from '@lulwah/utils';
import { connect, disconnect } from '../src/shared/mongo.js';
import { logger } from '../src/shared/logger.js';
import { env } from '../src/shared/env.js';
import { UserModel } from '../src/modules/identity/identity.model.js';
import { effectivePermissions } from '../src/modules/identity/identity.policy.js';
import type { AuthenticatedUser } from '../src/modules/identity/identity.policy.js';
import { BrandModel } from '../src/modules/catalog/brand.model.js';
import { CategoryModel } from '../src/modules/catalog/category.model.js';
import { CollectionModel } from '../src/modules/catalog/collection.model.js';
import { ProductModel } from '../src/modules/catalog/product.model.js';
import { VariantModel } from '../src/modules/catalog/variant.model.js';
import { InventoryItemModel } from '../src/modules/inventory/inventory-item.model.js';
import { StockMovementModel } from '../src/modules/inventory/stock-movement.model.js';
import * as brandService from '../src/modules/catalog/brand.service.js';
import * as categoryService from '../src/modules/catalog/category.service.js';
import * as collectionService from '../src/modules/catalog/collection.service.js';
import * as productService from '../src/modules/catalog/product.service.js';
import * as variantService from '../src/modules/catalog/variant.service.js';
import * as inventoryService from '../src/modules/inventory/inventory.service.js';
import { fullReindex } from '../src/modules/catalog/search.service.js';
import { AdminCreateBrandInput } from '../src/modules/catalog/brand.dto.js';
import { AdminCreateCategoryInput } from '../src/modules/catalog/category.dto.js';
import { AdminCreateCollectionInput } from '../src/modules/catalog/collection.dto.js';
import { AdminCreateProductInput, AdminCreateVariantInput } from '../src/modules/catalog/product.dto.js';
import { BRANDS, CATEGORY_TAXONOMY, PRODUCTS } from './seed-data.js';
import type { SeedProduct } from './seed-data.js';

const ADMIN_EMAIL = 'admin@lulwah.ae';
const ADMIN_PASSWORD = 'LulwahAdmin!2026';

/** Variants that go through a real `adjustStock` movement instead of just
 *  `initialOnHand`, per the brief's "a couple should have ... real
 *  inventory rows" — demonstrates the audit-trail write path, not only
 *  the creation-time shortcut. Keyed by SKU → target onHand. */
const STOCK_VIA_MOVEMENT: Record<string, number> = {
  'KHAS-26-107-FZ': 14,
  'KHAS-26-107-OW': 9,
  'KHAS-26-107-MG': 0, // deliberately left out of stock — shows the "sold out" state
  'SS-PRET-26-041-XS': 3,
  'SS-PRET-26-041-S': 8,
  'SS-PRET-26-041-M': 11,
  'SS-PRET-26-041-L': 6,
  'SS-PRET-26-041-XL': 2,
  'MB-FEST-26-019-RB': 3,
  'MB-FEST-26-019-WN': 1,
  'MB-FEST-26-019-EM': 0,
};

async function seedAdminUser(): Promise<string> {
  const existing = await UserModel.findOne({ email: ADMIN_EMAIL });
  if (existing) return existing._id.toString();

  const passwordHash = await argon2.hash(ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: env.ARGON2_MEMORY,
    timeCost: env.ARGON2_TIME,
    parallelism: 1,
  });
  const created = await UserModel.create({
    email: ADMIN_EMAIL,
    passwordHash,
    provider: 'local',
    firstName: 'Lulwah',
    lastName: 'Admin',
    role: 'super_admin',
  });
  logger.info({ email: ADMIN_EMAIL }, 'seed: created super_admin user (see scripts/seed.ts for the password)');
  return created._id.toString();
}

async function clearCatalogAndInventory(): Promise<void> {
  await Promise.all([
    BrandModel.deleteMany({}),
    CategoryModel.deleteMany({}),
    CollectionModel.deleteMany({}),
    ProductModel.deleteMany({}),
    VariantModel.deleteMany({}),
    InventoryItemModel.deleteMany({}),
    StockMovementModel.deleteMany({}),
  ]);
}

async function seedCategories(actor: AuthenticatedUser): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const group of CATEGORY_TAXONOMY) {
    const parentSlug = slugify(group.name);
    // `.parse()` here (not a raw object literal) so every field with a Zod
    // `.default()` — the vast majority of an admin DTO's fields — actually
    // gets filled in, exactly as `AdminCreateCategoryInput.parse(req.body)`
    // does at the real HTTP controller (`category.controller.ts`).
    const parent = await categoryService.createCategory(actor, AdminCreateCategoryInput.parse({ name: group.name }));
    idBySlug.set(parentSlug, parent.id);
    for (const childName of group.children ?? []) {
      const child = await categoryService.createCategory(actor, AdminCreateCategoryInput.parse({ name: childName, parentId: parent.id }));
      idBySlug.set(slugify(childName), child.id);
    }
  }
  return idBySlug;
}

async function seedBrands(actor: AuthenticatedUser): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const brand of BRANDS) {
    const created = await brandService.createBrand(
      actor,
      AdminCreateBrandInput.parse({
        name: brand.name,
        slug: brand.slug,
        countryOfOrigin: brand.countryOfOrigin,
        description: brand.description,
        isFeatured: true,
      }),
    );
    idBySlug.set(brand.slug, created.id);
  }
  return idBySlug;
}

interface CreatedProduct {
  id: string;
  seed: SeedProduct;
}

async function seedProducts(actor: AuthenticatedUser, brandIdBySlug: Map<string, string>, categoryIdBySlug: Map<string, string>): Promise<CreatedProduct[]> {
  const created: CreatedProduct[] = [];

  for (const seed of PRODUCTS) {
    const brandId = brandIdBySlug.get(seed.brandSlug);
    const categoryId = categoryIdBySlug.get(seed.categorySlug);
    if (!brandId || !categoryId) {
      throw new Error(`seed: unknown brandSlug/categorySlug for "${seed.title}" (${seed.brandSlug}/${seed.categorySlug})`);
    }

    const product = await productService.createProduct(
      actor,
      AdminCreateProductInput.parse({
        title: seed.title,
        articleCode: seed.articleCode,
        brandId,
        primaryCategoryId: categoryId,
        categoryIds: [categoryId],
        stitchingType: seed.stitchingType,
        pieceCount: seed.pieceCount,
        fabric: seed.fabric,
        secondaryFabrics: seed.secondaryFabrics ?? [],
        work: seed.work,
        dupattaType: seed.dupattaType ?? null,
        occasion: seed.occasion,
        season: seed.season,
        colorName: seed.colorName,
        colorFamily: seed.colorFamily,
        colorHex: seed.colorHex,
        basePriceFils: seed.basePriceFils,
        compareAtPriceFils: seed.compareAtPriceFils ?? null,
        isCustomStitchAvailable: seed.isCustomStitchAvailable ?? false,
        stitchingPriceFils: seed.stitchingPriceFils ?? null,
        stitchingLeadDays: seed.stitchingLeadDays ?? null,
        status: 'active',
        isFeatured: seed.isFeatured ?? false,
        isNewIn: seed.isNewIn ?? false,
        badges: seed.badges ?? [],
        seo: { descEn: seed.descriptionEn },
      }),
    );

    for (const variant of seed.variants) {
      const onHandViaMovement = STOCK_VIA_MOVEMENT[variant.sku];
      const created2 = await variantService.createVariant(
        actor,
        product.id,
        AdminCreateVariantInput.parse({
          sku: variant.sku,
          options: { ...(variant.size ? { size: variant.size } : {}), ...(variant.color ? { color: variant.color } : {}) },
          priceFils: variant.priceFils ?? seed.basePriceFils,
          weightGrams: seed.pieceCount === 1 ? 200 : 350,
          initialOnHand: onHandViaMovement === undefined ? variant.onHand : 0,
        }),
      );

      // A subset go through a real stock-adjustment movement instead of
      // the creation-time shortcut — see `STOCK_VIA_MOVEMENT`'s doc comment.
      if (onHandViaMovement !== undefined && onHandViaMovement > 0) {
        await inventoryService.adjustStock(actor, created2.id, {
          quantity: onHandViaMovement,
          type: 'purchase',
          reason: `Initial stock receipt — ${seed.title} (seed data)`,
        });
      }
    }

    created.push({ id: product.id, seed });
  }

  return created;
}

async function seedCollections(actor: AuthenticatedUser, products: CreatedProduct[]): Promise<void> {
  const lawnVolOneIds = products.filter((p) => p.seed.fabric === 'lawn' && p.seed.stitchingType === 'unstitched').map((p) => p.id);
  const eidEditIds = products.filter((p) => p.seed.occasion.includes('eid')).map((p) => p.id);
  const saleIds = products.filter((p) => p.seed.compareAtPriceFils !== undefined && p.seed.compareAtPriceFils > p.seed.basePriceFils).map((p) => p.id);

  await collectionService.createCollection(
    actor,
    AdminCreateCollectionInput.parse({
      name: "Lawn '26 — Volume One",
      slug: 'lawn-26-vol-1',
      subtitle: "Forty-two designs, cut for Dubai's summer.",
      descriptionEn: "This season's unstitched lawn, across every brand in the house — matches apps/web's Hero section copy.",
      type: 'seasonal',
      productIds: lawnVolOneIds,
      status: 'active',
      layout: 'grid',
      isFeatured: true,
    }),
  );

  await collectionService.createCollection(
    actor,
    AdminCreateCollectionInput.parse({
      name: "Eid Edition '26",
      slug: 'eid-edition-26',
      subtitle: 'Eid Edition, in five silhouettes',
      descriptionEn: "Forty-two pieces from Pakistan's leading fashion houses — the Eid-occasion edit across brands.",
      type: 'editorial',
      productIds: eidEditIds,
      status: 'active',
      layout: 'editorial',
      isFeatured: true,
    }),
  );

  await collectionService.createCollection(
    actor,
    AdminCreateCollectionInput.parse({
      name: 'Season End Sale',
      slug: 'season-end-sale',
      subtitle: 'Marked down, not marked up first',
      descriptionEn: "Every compare-at price here was the live selling price — plan.md §8.2's consumer-protection rule, not a fake strike-through.",
      type: 'sale',
      productIds: saleIds,
      status: 'active',
      layout: 'grid',
    }),
  );
}

async function main(): Promise<void> {
  await connect();
  logger.info('seed: connected to MongoDB');

  const adminUserId = await seedAdminUser();
  const actor: AuthenticatedUser = {
    id: adminUserId,
    role: 'super_admin',
    permissions: effectivePermissions('super_admin', []),
    sessionId: new Types.ObjectId().toString(),
  };

  await clearCatalogAndInventory();
  logger.info('seed: cleared catalog/inventory collections');

  const categoryIdBySlug = await seedCategories(actor);
  logger.info({ count: categoryIdBySlug.size }, 'seed: categories created');

  const brandIdBySlug = await seedBrands(actor);
  logger.info({ count: brandIdBySlug.size }, 'seed: brands created');

  const products = await seedProducts(actor, brandIdBySlug, categoryIdBySlug);
  logger.info({ count: products.length }, 'seed: products + variants + inventory created');

  await seedCollections(actor, products);
  logger.info('seed: collections created');

  try {
    const { indexed } = await fullReindex();
    logger.info({ indexed }, 'seed: Meilisearch reindex complete (no-op if MEILI_HOST is unset)');
  } catch (err) {
    // plan.md §7.14: search degrades gracefully — a reindex failure must
    // not fail the whole seed run.
    logger.warn({ err }, 'seed: Meilisearch reindex failed — Mongo data is still seeded correctly');
  }

  await disconnect();
  logger.info('seed: done');
}

main().catch((err: unknown) => {
  logger.error({ err }, 'seed failed');
  process.exit(1);
});
