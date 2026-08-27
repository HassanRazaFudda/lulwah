import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Express } from 'express';
import { createApp } from '../../../app.js';
import { connect, disconnect } from '../../../shared/mongo.js';
import { InMemoryRateLimitStore } from '../../../shared/rate-limit.js';
import { InMemoryReservationStore } from '../../cart/reservation-store.js';
import { InMemoryIdempotencyStore } from '../../checkout/idempotency-store.js';
import { SessionModel, UserModel } from '../../identity/identity.model.js';
import { HomeSectionModel } from '../home-section.model.js';
import { BannerModel } from '../banner.model.js';
import { MenuModel } from '../menu.model.js';
import { PageModel } from '../page.model.js';
import { MediaAssetModel } from '../media-asset.model.js';

/**
 * Integration coverage for `content` — plan.md §11.1's Content admin
 * screen. Exercises the real HTTP surface (routes → controllers →
 * services → repositories → Mongoose) against `mongodb-memory-server`,
 * same pattern as `inventory.integration.test.ts`/`checkout.integration.test.ts`.
 */

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connect(mongo.getUri());
  await Promise.all([
    UserModel.syncIndexes(),
    SessionModel.syncIndexes(),
    HomeSectionModel.syncIndexes(),
    BannerModel.syncIndexes(),
    MenuModel.syncIndexes(),
    PageModel.syncIndexes(),
    MediaAssetModel.syncIndexes(),
  ]);
}, 60_000);

afterAll(async () => {
  await disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    UserModel.deleteMany({}),
    SessionModel.deleteMany({}),
    HomeSectionModel.deleteMany({}),
    BannerModel.deleteMany({}),
    MenuModel.deleteMany({}),
    PageModel.deleteMany({}),
    MediaAssetModel.deleteMany({}),
  ]);
});

function buildApp(): Express {
  return createApp({
    rateLimitStore: new InMemoryRateLimitStore(),
    reservationStore: new InMemoryReservationStore(),
    idempotencyStore: new InMemoryIdempotencyStore(),
  });
}

let phoneCounter = 550000000;

async function createUserAndLogin(app: Express, role: 'super_admin' | 'content' | 'customer' = 'super_admin'): Promise<string> {
  phoneCounter += 1;
  const email = `user-${phoneCounter}@example.com`;
  const password = 'correct-horse-battery-staple';
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'A', lastName: 'B', phone: { countryCode: '+971', number: String(phoneCounter) } });
  if (role !== 'customer') await UserModel.updateOne({ email }, { role });
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
  return loginRes.body.data.accessToken as string;
}

describe('home sections', () => {
  it('creates a hero section with type-validated settings, lists it, and reorders it', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app, 'content');

    const heroRes = await request(app)
      .post('/api/v1/admin/content/home-sections')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'hero',
        settings: {
          headlineEn: 'Lawn Vol. 1',
          headlineAr: 'لان',
          media: null,
          mediaMobile: null,
          videoUrl: null,
          linkLabelEn: 'See the collection',
          linkLabelAr: 'شاهد المجموعة',
          linkHref: '/collections/lawn-vol-1',
          collectionId: null,
        },
      });
    expect(heroRes.status).toBe(201);
    expect(heroRes.body.data.section.type).toBe('hero');
    expect(heroRes.body.data.section.settings.headlineEn).toBe('Lawn Vol. 1');

    const uspRes = await request(app)
      .post('/api/v1/admin/content/home-sections')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'usp_bar', settings: { itemsEn: ['Authentic designer pieces'], itemsAr: ['قطع مصممة أصلية'] } });
    expect(uspRes.status).toBe(201);

    const listRes = await request(app).get('/api/v1/admin/content/home-sections').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.sections).toHaveLength(2);

    // Reorder — usp_bar first, hero second.
    const reorderRes = await request(app)
      .post('/api/v1/admin/content/home-sections/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderedIds: [uspRes.body.data.section.id, heroRes.body.data.section.id] });
    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body.data.sections[0].type).toBe('usp_bar');
    expect(reorderRes.body.data.sections[0].sortOrder).toBe(0);
    expect(reorderRes.body.data.sections[1].type).toBe('hero');
    expect(reorderRes.body.data.sections[1].sortOrder).toBe(1);
  });

  it('rejects settings that do not match the section type (VALIDATION_FAILED)', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app, 'content');

    const res = await request(app)
      .post('/api/v1/admin/content/home-sections')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'hero', settings: { notARealField: true } });
    expect(res.status).toBe(400);
  });

  it('a plain customer cannot write content (403), but content.read is enough to list', async () => {
    const app = buildApp();
    const adminToken = await createUserAndLogin(app, 'super_admin');
    await request(app)
      .post('/api/v1/admin/content/home-sections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'usp_bar', settings: { itemsEn: ['a'], itemsAr: ['ب'] } });

    const customerToken = await createUserAndLogin(app, 'customer');
    const writeRes = await request(app)
      .post('/api/v1/admin/content/home-sections')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ type: 'usp_bar', settings: { itemsEn: ['a'], itemsAr: ['ب'] } });
    expect(writeRes.status).toBe(403);
  });

  it('GET /content/home returns only active, in-window sections, in sortOrder — no admin fields', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app, 'content');

    const active = await request(app)
      .post('/api/v1/admin/content/home-sections')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'usp_bar', settings: { itemsEn: ['Active'], itemsAr: ['نشط'] }, sortOrder: 1, isActive: true });

    await request(app)
      .post('/api/v1/admin/content/home-sections')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'usp_bar', settings: { itemsEn: ['Inactive'], itemsAr: ['غير نشط'] }, sortOrder: 0, isActive: false });

    const futureRes = await request(app)
      .post('/api/v1/admin/content/home-sections')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'usp_bar',
        settings: { itemsEn: ['Not yet'], itemsAr: ['ليس بعد'] },
        sortOrder: 2,
        isActive: true,
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
    expect(futureRes.status).toBe(201);

    const publicRes = await request(app).get('/api/v1/content/home');
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.sections).toHaveLength(1);
    expect(publicRes.body.data.sections[0].id).toBe(active.body.data.section.id);
    expect(publicRes.body.data.sections[0]).not.toHaveProperty('isActive');
    expect(publicRes.body.data.sections[0]).not.toHaveProperty('startsAt');
  });
});

describe('banners', () => {
  it('creates a banner and exposes it publicly only for its placement while active', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app, 'content');

    const res = await request(app)
      .post('/api/v1/admin/content/banners')
      .set('Authorization', `Bearer ${token}`)
      .send({ placement: 'homepage_top', textEn: 'Free shipping over AED 250', textAr: 'شحن مجاني', isActive: true });
    expect(res.status).toBe(201);

    const publicTop = await request(app).get('/api/v1/content/banners?placement=homepage_top');
    expect(publicTop.body.data.banners).toHaveLength(1);
    expect(publicTop.body.data.banners[0].textEn).toBe('Free shipping over AED 250');

    const publicCart = await request(app).get('/api/v1/content/banners?placement=cart');
    expect(publicCart.body.data.banners).toHaveLength(0);
  });
});

describe('menus', () => {
  it('creates a nested menu, assigns ids to new items, and serves it publicly by location', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app, 'content');

    const res = await request(app)
      .post('/api/v1/admin/content/menus')
      .set('Authorization', `Bearer ${token}`)
      .send({
        location: 'header',
        items: [
          {
            label: 'Unstitched',
            labelAr: 'غير مخيط',
            href: '/shop/unstitched',
            sortOrder: 0,
            children: [{ label: 'Lawn', labelAr: 'لان', href: '/shop/unstitched/lawn', sortOrder: 0, children: [] }],
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.menu.items[0].id).toBeTruthy();
    expect(res.body.data.menu.items[0].children[0].id).toBeTruthy();
    expect(res.body.data.menu.items[0].children[0].label).toBe('Lawn');

    const publicRes = await request(app).get('/api/v1/content/menus/header');
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.menu.items[0].children[0].href).toBe('/shop/unstitched/lawn');

    const missingRes = await request(app).get('/api/v1/content/menus/footer');
    expect(missingRes.status).toBe(404);
  });

  it('rejects a second menu for the same location (CONFLICT)', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app, 'content');
    await request(app).post('/api/v1/admin/content/menus').set('Authorization', `Bearer ${token}`).send({ location: 'footer', items: [] });
    const dup = await request(app).post('/api/v1/admin/content/menus').set('Authorization', `Bearer ${token}`).send({ location: 'footer', items: [] });
    expect(dup.status).toBe(409);
  });
});

describe('pages', () => {
  it('sanitizes rich-text body HTML on write and serves only published pages publicly', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app, 'content');

    const draftRes = await request(app)
      .post('/api/v1/admin/content/pages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titleEn: 'Fabric Guide',
        titleAr: 'دليل القماش',
        bodyEn: '<p>Lawn is a fine cotton fabric.</p><script>alert(1)</script><img src=x onerror=alert(2)>',
        bodyAr: '<p>القطن</p>',
        status: 'draft',
      });
    expect(draftRes.status).toBe(201);
    expect(draftRes.body.data.page.bodyEn).toContain('<p>Lawn is a fine cotton fabric.</p>');
    expect(draftRes.body.data.page.bodyEn).not.toContain('<script>');
    expect(draftRes.body.data.page.bodyEn).not.toContain('onerror');
    const slug = draftRes.body.data.page.slug;

    const draftPublicRes = await request(app).get(`/api/v1/content/pages/${slug}`);
    expect(draftPublicRes.status).toBe(404);

    const publishRes = await request(app)
      .patch(`/api/v1/admin/content/pages/${draftRes.body.data.page.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'published' });
    expect(publishRes.status).toBe(200);

    const publishedPublicRes = await request(app).get(`/api/v1/content/pages/${slug}`);
    expect(publishedPublicRes.status).toBe(200);
    expect(publishedPublicRes.body.data.page.titleEn).toBe('Fabric Guide');
    expect(publishedPublicRes.body.data.page).not.toHaveProperty('status');
  });

  it('rejects a duplicate slug (CONFLICT)', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app, 'content');
    await request(app).post('/api/v1/admin/content/pages').set('Authorization', `Bearer ${token}`).send({ titleEn: 'About', slug: 'about' });
    const dup = await request(app).post('/api/v1/admin/content/pages').set('Authorization', `Bearer ${token}`).send({ titleEn: 'About Us', slug: 'about' });
    expect(dup.status).toBe(409);
  });
});

describe('media library', () => {
  it('creates assets (paste-a-URL), lists distinct folders, searches by alt text, and bulk-edits alt text', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app, 'content');

    const first = await request(app)
      .post('/api/v1/admin/content/media')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/lawn-macro.jpg', alt: 'Lawn fabric macro', folder: 'campaigns' });
    const second = await request(app)
      .post('/api/v1/admin/content/media')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com/model-1.jpg', alt: 'Model wearing lawn suit', folder: 'campaigns' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const foldersRes = await request(app).get('/api/v1/admin/content/media/folders').set('Authorization', `Bearer ${token}`);
    expect(foldersRes.body.data.folders).toEqual(['campaigns']);

    const searchRes = await request(app).get('/api/v1/admin/content/media?search=macro').set('Authorization', `Bearer ${token}`);
    expect(searchRes.body.data.assets).toHaveLength(1);
    expect(searchRes.body.data.assets[0].id).toBe(first.body.data.asset.id);

    const bulkRes = await request(app)
      .patch('/api/v1/admin/content/media/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({
        updates: [
          { id: first.body.data.asset.id, altAr: 'قماش لان' },
          { id: second.body.data.asset.id, altAr: 'عارضة ترتدي بدلة لان' },
        ],
      });
    expect(bulkRes.status).toBe(200);
    expect(bulkRes.body.data.assets.map((a: { altAr: string }) => a.altAr).sort()).toEqual(['عارضة ترتدي بدلة لان', 'قماش لان'].sort());
  });

  it('rejects a bulk update referencing an unknown id (VALIDATION_FAILED), writing nothing', async () => {
    const app = buildApp();
    const token = await createUserAndLogin(app, 'content');
    const created = await request(app).post('/api/v1/admin/content/media').set('Authorization', `Bearer ${token}`).send({ url: 'https://example.com/x.jpg' });

    const res = await request(app)
      .patch('/api/v1/admin/content/media/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ updates: [{ id: created.body.data.asset.id, alt: 'new alt' }, { id: '64b7f7f7f7f7f7f7f7f7f7f7', alt: 'ghost' }] });
    expect(res.status).toBe(400);

    const unchanged = await request(app).get(`/api/v1/admin/content/media/${created.body.data.asset.id}`).set('Authorization', `Bearer ${token}`);
    expect(unchanged.body.data.asset.alt).toBe('');
  });
});
