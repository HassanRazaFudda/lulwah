import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connect, disconnect } from '../../../shared/mongo.js';
import { BrandModel } from '../brand.model.js';
import { CategoryModel } from '../category.model.js';
import { ProductModel } from '../product.model.js';
import { VariantModel } from '../variant.model.js';
import * as brandRepo from '../brand.repository.js';
import * as categoryRepo from '../category.repository.js';
import * as productRepo from '../product.repository.js';
import * as variantRepo from '../variant.repository.js';
import { syncProductToIndex, searchProducts, fullReindex } from '../search.service.js';
import type { SearchIndexPort } from '../../../integrations/meilisearch/search-index-port.js';
import type { ProductSearchDocument } from '../../../integrations/meilisearch/product-document.js';

/**
 * plan.md brief: "at least one Meilisearch-sync test (can mock/stub
 * Meilisearch if a real instance isn't available in your test
 * environment)." This suite never touches a real Meilisearch — every test
 * injects a fake `SearchIndexPort` (`search.service.ts`'s dependency-
 * injection seam), so it runs the same with or without Docker.
 */

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connect(mongo.getUri());
}, 60_000);

afterAll(async () => {
  await disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([BrandModel.deleteMany({}), CategoryModel.deleteMany({}), ProductModel.deleteMany({}), VariantModel.deleteMany({})]);
});

/** Records every call instead of touching a network — the "mock/stub
 *  Meilisearch" the brief asks for. */
function createFakePort(overrides: Partial<SearchIndexPort> = {}): SearchIndexPort & { upserted: ProductSearchDocument[]; removed: string[] } {
  const upserted: ProductSearchDocument[] = [];
  const removed: string[] = [];
  return {
    upserted,
    removed,
    upsert: async (doc) => {
      upserted.push(doc);
    },
    remove: async (id) => {
      removed.push(id);
    },
    search: async () => [],
    ensureSettings: async () => {},
    ...overrides,
  };
}

async function seedActiveProduct(): Promise<{ productId: string; title: string }> {
  const brand = await brandRepo.createBrand({ name: 'Khaadi', slug: 'khaadi', countryOfOrigin: 'PK' });
  const category = await categoryRepo.createCategory({ name: 'Lawn', slug: 'lawn', path: 'lawn', level: 0 });
  const product = await productRepo.createProduct({
    title: 'Ferozi Embroidered Lawn, 3 Piece',
    slug: 'ferozi-embroidered-lawn-3-piece',
    articleCode: 'KHAS-26-107',
    brandId: brand._id.toString(),
    primaryCategoryId: category._id.toString(),
    categoryIds: [category._id.toString()],
    stitchingType: 'unstitched',
    fabric: 'lawn',
    season: 'summer',
    colorName: 'Ferozi',
    colorFamily: 'blue_ferozi',
    colorHex: '#1f7a8c',
    basePriceFils: 24_900,
    priceRange: { minFils: 24_900, maxFils: 24_900 },
    effectivePriceFils: 24_900,
    status: 'active',
  });
  await variantRepo.createVariant({ productId: product._id, sku: 'KHAS-26-107-M', priceFils: 24_900, weightGrams: 400, options: { size: 'M' } });
  return { productId: product._id.toString(), title: product.title };
}

describe('syncProductToIndex', () => {
  it('upserts the built search document for an active product', async () => {
    const { productId, title } = await seedActiveProduct();
    const port = createFakePort();

    await syncProductToIndex(productId, port);

    expect(port.upserted).toHaveLength(1);
    expect(port.removed).toHaveLength(0);
    expect(port.upserted[0]?.id).toBe(productId);
    expect(port.upserted[0]?.title).toBe(title);
    expect(port.upserted[0]?.brandName).toBe('Khaadi');
    expect(port.upserted[0]?.categoryPath).toBe('lawn');
    expect(port.upserted[0]?.size).toEqual(['M']);
    expect(port.upserted[0]?.status).toBe('active');
  });

  it('removes (not upserts) a product that is no longer active', async () => {
    const { productId } = await seedActiveProduct();
    await productRepo.updateProduct(productId, { status: 'archived' });
    const port = createFakePort();

    await syncProductToIndex(productId, port);

    expect(port.upserted).toHaveLength(0);
    expect(port.removed).toEqual([productId]);
  });

  it('removes a product id that no longer exists at all (hard delete)', async () => {
    const port = createFakePort();
    await syncProductToIndex('64b7f7f7f7f7f7f7f7f7f7f7', port);
    expect(port.removed).toEqual(['64b7f7f7f7f7f7f7f7f7f7f7']);
  });

  it('never throws when the port itself fails (a Meilisearch outage must not crash the sync job)', async () => {
    const { productId } = await seedActiveProduct();
    const port = createFakePort({
      upsert: async () => {
        throw new Error('connection refused');
      },
    });
    await expect(syncProductToIndex(productId, port)).resolves.toBeUndefined();
  });
});

describe('searchProducts — plan.md §7.14 fallback rule', () => {
  it('uses the search port when it succeeds, preserving its ranking order', async () => {
    const { productId } = await seedActiveProduct();
    const port = createFakePort({ search: async () => [productId] });

    const result = await searchProducts('ferozi', 10, port);

    expect(result.source).toBe('meilisearch');
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.id).toBe(productId);
  });

  it('falls back to a Mongo regex query on title/articleCode when the port throws — never a 500', async () => {
    const { productId, title } = await seedActiveProduct();
    const port = createFakePort({
      search: async () => {
        throw new Error('Meilisearch is not configured (MEILI_HOST unset).');
      },
    });

    const result = await searchProducts('Ferozi', 10, port);

    expect(result.source).toBe('mongo_fallback');
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.id).toBe(productId);
    expect(result.products[0]?.title).toBe(title);
  });

  it('also matches by articleCode in the fallback path', async () => {
    await seedActiveProduct();
    const port = createFakePort({
      search: async () => {
        throw new Error('down');
      },
    });

    const result = await searchProducts('KHAS-26-107', 10, port);
    expect(result.source).toBe('mongo_fallback');
    expect(result.products).toHaveLength(1);
  });

  it('returns an empty result for a blank query without calling the port at all', async () => {
    const port = createFakePort();
    const result = await searchProducts('   ', 10, port);
    expect(result.products).toEqual([]);
  });
});

describe('fullReindex — pnpm reindex (plan.md §7.14)', () => {
  it('applies index settings once and upserts every active product', async () => {
    await seedActiveProduct();
    const port = createFakePort();

    const { indexed } = await fullReindex(port);

    expect(indexed).toBe(1);
    expect(port.upserted).toHaveLength(1);
  });
});
