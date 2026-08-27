import { Router } from 'express';
import * as homeSectionController from './home-section.controller.js';
import * as bannerController from './banner.controller.js';
import * as menuController from './menu.controller.js';
import * as pageController from './page.controller.js';
import * as mediaAssetController from './media-asset.controller.js';
import { requireContentRead, requireContentWrite } from './content.policy.js';

/**
 * HTTP wiring only (plan.md §5.4) — path, middleware, handler binding, no
 * logic. Mounted at `API_PREFIX` by `app.ts`, so routes below resolve to
 * `/api/v1/content/*` (public, new — plan.md §11.1's Content screen needs
 * a storefront-facing read surface a later phase will consume) and
 * `/api/v1/admin/content/*` (the admin CRUD this phase actually builds
 * against).
 *
 * Route-ordering note: literal sub-paths (`/media/folders`, `/media/bulk`,
 * `/home-sections/reorder`) are registered before their sibling `/:id`
 * route wherever both share the same HTTP method — Express matches routes
 * in registration order, so a `:id` route registered first would swallow
 * a request meant for the literal path (`id` would just bind to the
 * literal segment's text).
 */
export function createContentRouter(): Router {
  const router = Router();

  // --- public — new for `content`, matching the public/admin route split
  // `catalog.routes.ts` already establishes -----------------------------
  router.get('/content/home', homeSectionController.getPublicHome);
  router.get('/content/banners', bannerController.listPublic);
  router.get('/content/pages/:slug', pageController.getPublicBySlug);
  router.get('/content/menus/:key', menuController.getPublicByLocation);

  // --- admin: home sections ---------------------------------------------
  router.get('/admin/content/home-sections', ...requireContentRead(), homeSectionController.adminList);
  router.post('/admin/content/home-sections', ...requireContentWrite(), homeSectionController.adminCreate);
  router.post('/admin/content/home-sections/reorder', ...requireContentWrite(), homeSectionController.adminReorder);
  router.get('/admin/content/home-sections/:id', ...requireContentRead(), homeSectionController.adminGet);
  router.patch('/admin/content/home-sections/:id', ...requireContentWrite(), homeSectionController.adminUpdate);
  router.delete('/admin/content/home-sections/:id', ...requireContentWrite(), homeSectionController.adminDelete);

  // --- admin: banners -----------------------------------------------------
  router.get('/admin/content/banners', ...requireContentRead(), bannerController.adminList);
  router.post('/admin/content/banners', ...requireContentWrite(), bannerController.adminCreate);
  router.get('/admin/content/banners/:id', ...requireContentRead(), bannerController.adminGet);
  router.patch('/admin/content/banners/:id', ...requireContentWrite(), bannerController.adminUpdate);
  router.delete('/admin/content/banners/:id', ...requireContentWrite(), bannerController.adminDelete);

  // --- admin: menus ---------------------------------------------------------
  router.get('/admin/content/menus', ...requireContentRead(), menuController.adminList);
  router.post('/admin/content/menus', ...requireContentWrite(), menuController.adminCreate);
  router.get('/admin/content/menus/:id', ...requireContentRead(), menuController.adminGet);
  router.patch('/admin/content/menus/:id', ...requireContentWrite(), menuController.adminUpdate);
  router.delete('/admin/content/menus/:id', ...requireContentWrite(), menuController.adminDelete);

  // --- admin: pages ---------------------------------------------------------
  router.get('/admin/content/pages', ...requireContentRead(), pageController.adminList);
  router.post('/admin/content/pages', ...requireContentWrite(), pageController.adminCreate);
  router.get('/admin/content/pages/:id', ...requireContentRead(), pageController.adminGet);
  router.patch('/admin/content/pages/:id', ...requireContentWrite(), pageController.adminUpdate);
  router.delete('/admin/content/pages/:id', ...requireContentWrite(), pageController.adminDelete);

  // --- admin: media library ---------------------------------------------
  router.get('/admin/content/media/folders', ...requireContentRead(), mediaAssetController.adminListFolders);
  router.patch('/admin/content/media/bulk', ...requireContentWrite(), mediaAssetController.adminBulkUpdate);
  router.get('/admin/content/media', ...requireContentRead(), mediaAssetController.adminList);
  router.post('/admin/content/media', ...requireContentWrite(), mediaAssetController.adminCreate);
  router.get('/admin/content/media/:id', ...requireContentRead(), mediaAssetController.adminGet);
  router.patch('/admin/content/media/:id', ...requireContentWrite(), mediaAssetController.adminUpdate);
  router.delete('/admin/content/media/:id', ...requireContentWrite(), mediaAssetController.adminDelete);

  return router;
}
