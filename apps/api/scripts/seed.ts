/**
 * `pnpm seed` — plan.md §28's P1 next-step, built for real (this file was
 * previously a documented stub — see `docs/implemented-plan.md` §4.3).
 *
 * Seeds, in order: the locked §7.4 category tree, the 6 brands already
 * referenced in `apps/web/lib/placeholder-data.ts`, 30+ realistic Pakistani-
 * fashion products with variants and real inventory rows, 2–3 collections,
 * and (added in P3, once the `content` module existed to seed) a full real
 * homepage's worth of CMS content — every one of the 9 `home_sections`
 * types at least once, real banners, a real header menu, a couple of real
 * pages, and a handful of media library assets — see `seedContent()`. A
 * `super_admin` user is seeded too (upserted, not duplicated) so there's a
 * way into `/admin/*` on a fresh environment.
 *
 * Idempotent: catalog/inventory/content collections are all cleared and
 * fully reseeded on every run — simpler and less error-prone than
 * upserting field-by-field, and the brief explicitly allows either
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
import { HomeSectionModel } from '../src/modules/content/home-section.model.js';
import { BannerModel } from '../src/modules/content/banner.model.js';
import { MenuModel } from '../src/modules/content/menu.model.js';
import { PageModel } from '../src/modules/content/page.model.js';
import { MediaAssetModel } from '../src/modules/content/media-asset.model.js';
import * as brandService from '../src/modules/catalog/brand.service.js';
import * as categoryService from '../src/modules/catalog/category.service.js';
import * as collectionService from '../src/modules/catalog/collection.service.js';
import * as productService from '../src/modules/catalog/product.service.js';
import * as variantService from '../src/modules/catalog/variant.service.js';
import * as inventoryService from '../src/modules/inventory/inventory.service.js';
import * as homeSectionService from '../src/modules/content/home-section.service.js';
import * as bannerService from '../src/modules/content/banner.service.js';
import * as menuService from '../src/modules/content/menu.service.js';
import * as pageService from '../src/modules/content/page.service.js';
import * as mediaAssetService from '../src/modules/content/media-asset.service.js';
import { fullReindex } from '../src/modules/catalog/search.service.js';
import { AdminCreateBrandInput } from '../src/modules/catalog/brand.dto.js';
import { AdminCreateCategoryInput } from '../src/modules/catalog/category.dto.js';
import { AdminCreateCollectionInput } from '../src/modules/catalog/collection.dto.js';
import { AdminCreateProductInput, AdminCreateVariantInput } from '../src/modules/catalog/product.dto.js';
import { AdminCreateHomeSectionInput } from '../src/modules/content/home-section.dto.js';
import { AdminCreateBannerInput } from '../src/modules/content/banner.dto.js';
import { AdminCreateMenuInput } from '../src/modules/content/menu.dto.js';
import { AdminCreatePageInput } from '../src/modules/content/page.dto.js';
import { AdminCreateMediaAssetInput } from '../src/modules/content/media-asset.dto.js';
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

/** Separate from `clearCatalogAndInventory` — content is a genuinely
 *  different concern (plan.md §5.3), and clearing it is only needed
 *  because `seedContent` below is, like the rest of this script,
 *  clear-and-reseed rather than upsert. */
async function clearContent(): Promise<void> {
  await Promise.all([HomeSectionModel.deleteMany({}), BannerModel.deleteMany({}), MenuModel.deleteMany({}), PageModel.deleteMany({}), MediaAssetModel.deleteMany({})]);
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
          reason: `Initial stock receipt for ${seed.title} (seed data)`,
        });
      }
    }

    created.push({ id: product.id, seed });
  }

  return created;
}

async function seedCollections(actor: AuthenticatedUser, products: CreatedProduct[]): Promise<Map<string, string>> {
  const lawnVolOneIds = products.filter((p) => p.seed.fabric === 'lawn' && p.seed.stitchingType === 'unstitched').map((p) => p.id);
  const eidEditIds = products.filter((p) => p.seed.occasion.includes('eid')).map((p) => p.id);
  const saleIds = products.filter((p) => p.seed.compareAtPriceFils !== undefined && p.seed.compareAtPriceFils > p.seed.basePriceFils).map((p) => p.id);

  const idBySlug = new Map<string, string>();

  const lawn = await collectionService.createCollection(
    actor,
    AdminCreateCollectionInput.parse({
      name: "Lawn '26, Volume One",
      slug: 'lawn-26-vol-1',
      subtitle: "Forty-two designs, cut for Dubai's summer.",
      descriptionEn: "This season's unstitched lawn, across every brand in the house.",
      type: 'seasonal',
      productIds: lawnVolOneIds,
      status: 'active',
      layout: 'grid',
      isFeatured: true,
    }),
  );
  idBySlug.set('lawn-26-vol-1', lawn.id);

  const eid = await collectionService.createCollection(
    actor,
    AdminCreateCollectionInput.parse({
      name: "Eid Edition '26",
      slug: 'eid-edition-26',
      subtitle: 'Eid Edition, in five silhouettes',
      descriptionEn: "Forty-two pieces from Pakistan's leading fashion houses, the Eid-occasion edit across brands.",
      type: 'editorial',
      productIds: eidEditIds,
      status: 'active',
      layout: 'editorial',
      isFeatured: true,
    }),
  );
  idBySlug.set('eid-edition-26', eid.id);

  const sale = await collectionService.createCollection(
    actor,
    AdminCreateCollectionInput.parse({
      name: 'Season End Sale',
      slug: 'season-end-sale',
      subtitle: 'Marked down, not marked up first',
      descriptionEn: "Every compare-at price here was the live selling price before the markdown, never a fake strike-through.",
      type: 'sale',
      productIds: saleIds,
      status: 'active',
      layout: 'grid',
    }),
  );
  idBySlug.set('season-end-sale', sale.id);

  return idBySlug;
}

/**
 * Content/CMS seed data — plan.md §15.2's fixed Home section order, real
 * images from `apps/web/public/campaigns/`/`catalogue/` (the "royalty-free,
 * deliberately not the real brands' own photography" set §9/§29-risk#2
 * already documents), real collection/brand ids from what this script just
 * seeded above, and safe hrefs matching `Header.tsx`'s own real `NAV_LINKS`
 * — not invented routes. Exists so `pnpm seed` gives a fresh environment
 * something real to look at on both `/content` (admin) and the actual
 * homepage, not just an empty CMS the storefront's own fixed-layout
 * fallback (§5.1) silently papers over.
 *
 * Every image URL is web-app-relative (`/campaigns/...`) — these files live
 * in `apps/web/public/`, not anywhere `apps/admin` serves, so an admin
 * screen's own `<img>` preview may 404 against `admin`'s own origin; that
 * matches how a real deployed site's media would work too (reachable from
 * wherever it's actually hosted, not automatically from every app). The
 * point of these URLs is `apps/web` rendering them correctly, which is what
 * this data is for.
 */
/**
 * `lulwah-*.jpg` images (hero, the stitching/occasion tiles, the Eid
 * editorial — also reused below for the `homepage_top` banner and the
 * "Ready to wear"/"Formal & wedding" header-menu flyout thumbnails) —
 * real, styled South Asian formalwear/lawn photography, replacing the
 * original `panel-*`/`occasion-*`/`eid-edit-2026`/`lawn-26-vol1-hero`
 * fabric-macro shots those same slots used before. Found live, reported
 * by the user: a fabric-texture close-up is the wrong *kind* of image for
 * a tile whose job is showing what an outfit looks like, not what the
 * cloth feels like (the old `occasion-mehndi.jpg` — a green-and-gold
 * brocade swatch, no garment, no styling — standing in for an actual
 * "Mehndi" occasion tile was the clearest case of this). The `Banner`/
 * `Menu` content types aren't wired into any live `apps/web` page yet
 * (only `HomeSection` is — see `app/[locale]/page.tsx`), so those two
 * reuses aren't fixing something visibly broken on the storefront today,
 * only in `apps/admin`'s own Content screens — done anyway so nothing in
 * this seed still points at the old images. `video_banner`'s own
 * `fabric-macro-jamawar.jpg` is untouched — that section's whole point
 * (plan.md §15.2 §7: "a single fabric macro image, no text, pure rhythm")
 * is texture, so it was never actually mismatched.
 *
 * Sourced from Unsplash (Unsplash License — free for commercial use, no
 * permission/attribution required, though credited here anyway):
 * Muneeb Malhotra ("Eastern dresses 2024" / "lawn eastern dresses" shoots
 * — hero, unstitched/pret tiles, Eid editorial, Eid tile), iKshana
 * Productions (formal/wedding tile, Barat/Walima tiles), Bulbul Ahmed
 * (Mehndi and Everyday tiles). Every URL is a plain `images.unsplash.com`
 * link — the free tier — never `plus.unsplash.com` (Unsplash+, a paid
 * subscription tier with different terms this project has no license for;
 * several premium results from the same searches were deliberately
 * excluded for this reason).
 *
 * **Worth being direct about**: these are real, identifiable people's
 * faces, which the *license* permits commercially but doesn't itself
 * guarantee a model release for implying endorsement of a specific,
 * unrelated brand — a different question from copyright, and the reason
 * this project's own earlier photography (§9 of `docs/implemented-plan
 * .md`) had deliberately avoided face-visible portraits. Used here as
 * pre-launch placeholder content only, favoring shots where the garment
 * is the clear focus over ones that read as a personal portrait — not a
 * substitute for the client's own real photography before this site is
 * ever public, which remains `plan.md` §29 risk #2 either way.
 */
async function seedContent(actor: AuthenticatedUser, collectionIdBySlug: Map<string, string>): Promise<void> {
  const media = (publicId: string, width: number, height: number) => ({ publicId, url: `/campaigns/${publicId}.jpg`, width, height });

  const homeSections: AdminCreateHomeSectionInput[] = [
    {
      type: 'hero',
      settings: {
        headlineEn: "Lawn '26, Volume One",
        headlineAr: "لان ٢٦، الجزء الأول",
        media: media('lulwah-hero-lawn', 1600, 900),
        mediaMobile: null,
        videoUrl: null,
        linkLabelEn: 'Shop the collection',
        linkLabelAr: 'تسوقي المجموعة',
        linkHref: '/collections/lawn-26-vol-1',
        collectionId: collectionIdBySlug.get('lawn-26-vol-1') ?? null,
      },
      sortOrder: 0,
      isActive: true,
      startsAt: null,
      endsAt: null,
    },
    {
      type: 'collection_rail',
      settings: { titleEn: 'New arrivals', titleAr: 'وصل حديثاً', collectionId: null, limit: 6, viewAllHref: '/shop/new-in' },
      sortOrder: 1,
      isActive: true,
      startsAt: null,
      endsAt: null,
    },
    {
      type: 'category_grid',
      settings: {
        titleEn: 'Shop by stitching',
        titleAr: 'تسوقي حسب الخياطة',
        tiles: [
          { labelEn: 'Unstitched', labelAr: 'غير مخيط', image: media('lulwah-tile-unstitched', 1000, 1250), href: '/shop/unstitched' },
          { labelEn: 'Ready to wear', labelAr: 'جاهز للارتداء', image: media('lulwah-tile-pret', 1000, 1250), href: '/shop/pret' },
          { labelEn: 'Formal & wedding', labelAr: 'رسمي وزفاف', image: media('lulwah-tile-formal', 1000, 1250), href: '/shop/formal-wedding' },
        ],
      },
      sortOrder: 2,
      isActive: true,
      startsAt: null,
      endsAt: null,
    },
    {
      type: 'editorial_split',
      settings: {
        titleEn: 'The Eid Edit',
        titleAr: 'إصدار العيد',
        bodyEn: "Forty-two pieces from Pakistan's leading fashion houses: five silhouettes, one occasion.",
        bodyAr: 'اثنان وأربعون قطعة من دور الأزياء الرائدة في باكستان.',
        media: media('lulwah-editorial-eid', 1200, 1500),
        linkHref: '/collections/eid-edition-26',
        mediaPosition: 'left',
      },
      sortOrder: 3,
      isActive: true,
      startsAt: null,
      endsAt: null,
    },
    {
      type: 'collection_rail',
      settings: { titleEn: 'Best sellers', titleAr: 'الأكثر مبيعاً', collectionId: null, limit: 6, viewAllHref: '/shop/best-sellers' },
      sortOrder: 5,
      isActive: true,
      startsAt: null,
      endsAt: null,
    },
    {
      type: 'video_banner',
      settings: { media: media('fabric-macro-jamawar', 1920, 800), videoUrl: null, captionEn: 'Woven, not printed.', captionAr: 'منسوج، وليس مطبوعاً.' },
      sortOrder: 6,
      isActive: true,
      startsAt: null,
      endsAt: null,
    },
    {
      type: 'category_grid',
      settings: {
        titleEn: 'Shop by occasion',
        titleAr: 'تسوقي حسب المناسبة',
        tiles: [
          { labelEn: 'Eid', labelAr: 'العيد', image: media('lulwah-occasion-eid', 1000, 1250), href: '/collections/eid-edition-26' },
          { labelEn: 'Barat', labelAr: 'البرات', image: media('lulwah-occasion-barat', 1000, 1250), href: '/shop/formal-wedding' },
          { labelEn: 'Mehndi', labelAr: 'المهندي', image: media('lulwah-occasion-mehndi', 1000, 1250), href: '/shop/formal-wedding' },
          { labelEn: 'Walima', labelAr: 'الوليمة', image: media('lulwah-occasion-walima', 1000, 1250), href: '/shop/formal-wedding' },
          { labelEn: 'Everyday', labelAr: 'يومي', image: media('lulwah-occasion-everyday', 1000, 1250), href: '/shop/pret' },
        ],
      },
      sortOrder: 7,
      isActive: true,
      startsAt: null,
      endsAt: null,
    },
    {
      type: 'usp_bar',
      settings: {
        itemsEn: ['Free shipping over AED 300', 'Cash on delivery available', '7-day easy returns', 'Authentic designer pieces'],
        itemsAr: ['شحن مجاني للطلبات فوق ٣٠٠ درهم', 'الدفع عند الاستلام متاح', 'إرجاع سهل خلال ٧ أيام', 'قطع مصممة أصلية'],
      },
      sortOrder: 8,
      isActive: true,
      startsAt: null,
      endsAt: null,
    },
    {
      type: 'newsletter',
      settings: {
        headlineEn: 'Stay in the loop',
        headlineAr: 'ابقي على اطلاع',
        subtextEn: 'New arrivals, early access to drops, and the odd genuinely-good discount.',
        subtextAr: 'وصل جديد، وصول مبكر للإصدارات، وخصومات حقيقية بين الحين والآخر.',
      },
      sortOrder: 9,
      isActive: true,
      startsAt: null,
      endsAt: null,
    },
  ];
  for (const section of homeSections) {
    await homeSectionService.createHomeSection(actor, AdminCreateHomeSectionInput.parse(section));
  }
  logger.info({ count: homeSections.length }, 'seed: home sections created');

  const banners: AdminCreateBannerInput[] = [
    {
      placement: 'announcement',
      mediaDesktop: null,
      mediaMobile: null,
      link: null,
      textEn: 'Free shipping on orders over AED 300, to every emirate.',
      textAr: 'شحن مجاني للطلبات فوق ٣٠٠ درهم، لجميع الإمارات.',
      isActive: true,
      startsAt: null,
      endsAt: null,
      sortOrder: 0,
    },
    {
      placement: 'homepage_top',
      mediaDesktop: media('lulwah-editorial-eid', 1920, 480),
      mediaMobile: media('lulwah-editorial-eid', 800, 1000),
      link: '/collections/eid-edition-26',
      textEn: 'The Eid Edit is here',
      textAr: 'إصدار العيد وصل الآن',
      isActive: true,
      startsAt: null,
      endsAt: null,
      sortOrder: 0,
    },
    {
      placement: 'cart',
      mediaDesktop: null,
      mediaMobile: null,
      link: null,
      textEn: "Add AED 50 more to your bag for free shipping.",
      textAr: 'أضيفي ٥٠ درهم أخرى لحقيبتك للحصول على شحن مجاني.',
      isActive: true,
      startsAt: null,
      endsAt: null,
      sortOrder: 0,
    },
  ];
  for (const banner of banners) {
    await bannerService.createBanner(actor, AdminCreateBannerInput.parse(banner));
  }
  logger.info({ count: banners.length }, 'seed: banners created');

  await menuService.createMenu(
    actor,
    AdminCreateMenuInput.parse({
      location: 'header',
      isActive: true,
      items: [
        { label: 'Unstitched', labelAr: 'غير مخيط', href: '/shop/unstitched', featuredMedia: null, badge: null, sortOrder: 0, children: [] },
        {
          label: 'Ready to wear',
          labelAr: 'جاهز للارتداء',
          href: '/shop/pret',
          featuredMedia: media('lulwah-tile-pret', 600, 800),
          badge: null,
          sortOrder: 1,
          children: [
            { label: '2-piece sets', labelAr: 'طقم قطعتين', href: '/shop/pret', featuredMedia: null, badge: null, sortOrder: 0, children: [] },
            { label: '3-piece sets', labelAr: 'طقم ثلاث قطع', href: '/shop/pret', featuredMedia: null, badge: null, sortOrder: 1, children: [] },
          ],
        },
        {
          label: 'Formal & wedding',
          labelAr: 'رسمي وزفاف',
          href: '/shop/formal-wedding',
          featuredMedia: media('lulwah-tile-formal', 600, 800),
          badge: 'New',
          sortOrder: 2,
          children: [],
        },
        { label: 'Brands', labelAr: 'العلامات التجارية', href: '/brands', featuredMedia: null, badge: null, sortOrder: 3, children: [] },
        { label: 'Sale', labelAr: 'تخفيضات', href: '/shop/sale', featuredMedia: null, badge: null, sortOrder: 4, children: [] },
      ],
    }),
  );
  logger.info('seed: header menu created');

  const pages: AdminCreatePageInput[] = [
    {
      slug: 'shipping-returns',
      titleEn: 'Shipping & Returns',
      titleAr: 'الشحن والإرجاع',
      bodyEn: '<h2>Shipping</h2><p>Standard delivery is AED 20, free above AED 300, arriving in 1–4 days depending on your emirate.</p><h2>Returns</h2><p>Unworn items with tags attached can be returned within 7 days of delivery.</p>',
      bodyAr: '<h2>الشحن</h2><p>الشحن القياسي بسعر ٢٠ درهم، مجاني فوق ٣٠٠ درهم.</p>',
      status: 'published',
      seo: { titleEn: 'Shipping & Returns | Lulwah', descEn: 'Shipping rates, delivery times, and our 7-day return policy.' },
    },
    {
      slug: 'size-guide',
      titleEn: 'Size Guide',
      titleAr: 'دليل المقاسات',
      bodyEn: '<p>Measurements are in inches, taken flat. Unsure of your size? Message us before ordering.</p>',
      bodyAr: '<p>القياسات بالبوصة.</p>',
      status: 'published',
      seo: { titleEn: 'Size Guide | Lulwah' },
    },
    {
      slug: 'careers',
      titleEn: 'Careers',
      titleAr: 'الوظائف',
      bodyEn: '<p>We are not currently hiring, but check back soon.</p>',
      bodyAr: '',
      status: 'draft',
      seo: {},
    },
  ];
  for (const page of pages) {
    await pageService.createPage(actor, AdminCreatePageInput.parse(page));
  }
  logger.info({ count: pages.length }, 'seed: pages created (2 published, 1 draft)');

  const mediaAssets: AdminCreateMediaAssetInput[] = [
    { url: '/campaigns/lulwah-hero-lawn.jpg', type: 'image', width: 1600, height: 900, bytes: null, alt: "Lawn '26 Volume One hero", altAr: '', folder: 'Campaigns', tags: ['hero', 'lawn', 'campaign'], dominantColor: null },
    { url: '/campaigns/lulwah-editorial-eid.jpg', type: 'image', width: 1200, height: 1500, bytes: null, alt: 'Eid Edition 2026 editorial', altAr: '', folder: 'Campaigns', tags: ['eid', 'editorial', 'campaign'], dominantColor: null },
    { url: '/campaigns/fabric-macro-jamawar.jpg', type: 'image', width: 1920, height: 800, bytes: null, alt: 'Jamawar fabric macro detail', altAr: '', folder: 'Campaigns', tags: ['fabric', 'macro'], dominantColor: null },
    { url: '/catalogue/khaadi-ferozi-1.jpg', type: 'image', width: 1000, height: 1250, bytes: null, alt: 'Ferozi lawn product shot', altAr: '', folder: 'Products', tags: ['khaadi', 'lawn'], dominantColor: null },
    { url: '/catalogue/elan-noir-1.jpg', type: 'image', width: 1000, height: 1250, bytes: null, alt: 'Elan Noir formalwear', altAr: '', folder: 'Products', tags: ['elan', 'formal'], dominantColor: null },
  ];
  for (const asset of mediaAssets) {
    await mediaAssetService.createMediaAsset(actor, AdminCreateMediaAssetInput.parse(asset));
  }
  logger.info({ count: mediaAssets.length }, 'seed: media library assets created');
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
  await clearContent();
  logger.info('seed: cleared catalog/inventory/content collections');

  const categoryIdBySlug = await seedCategories(actor);
  logger.info({ count: categoryIdBySlug.size }, 'seed: categories created');

  const brandIdBySlug = await seedBrands(actor);
  logger.info({ count: brandIdBySlug.size }, 'seed: brands created');

  const products = await seedProducts(actor, brandIdBySlug, categoryIdBySlug);
  logger.info({ count: products.length }, 'seed: products + variants + inventory created');

  const collectionIdBySlug = await seedCollections(actor, products);
  logger.info({ count: collectionIdBySlug.size }, 'seed: collections created');

  await seedContent(actor, collectionIdBySlug);
  logger.info('seed: content (home sections, banners, menu, pages, media) created');

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
