import { Router } from 'express';
import * as brandController from './brand.controller.js';
import * as categoryController from './category.controller.js';
import * as collectionController from './collection.controller.js';
import * as productController from './product.controller.js';
import * as variantController from './variant.controller.js';
import * as searchController from './search.controller.js';
import { requireCatalogRead, requireCatalogWrite } from './catalog.policy.js';

/**
 * HTTP wiring only (plan.md §5.4) — path, middleware, handler binding, no
 * logic. Mounted at `API_PREFIX` by `app.ts`, so routes below resolve to
 * `/api/v1/products*`, `/api/v1/brands*`, `/api/v1/categories*`,
 * `/api/v1/collections*`, `/api/v1/search`, and `/api/v1/admin/{products,
 * brands,categories,collections}*` (plan.md §9.2, §9.7).
 */
export function createCatalogRouter(): Router {
  const router = Router();

  // --- public — plan.md §9.2 ------------------------------------------------
  router.get('/products', productController.listPublic);
  router.get('/products/:slug', productController.getPublicBySlug);
  router.get('/products/:slug/related', productController.getRelated);

  router.get('/collections', collectionController.listPublic);
  router.get('/collections/:slug', collectionController.getPublicBySlug);

  router.get('/brands', brandController.listPublic);
  router.get('/brands/:slug', brandController.getPublicBySlug);

  router.get('/categories/tree', categoryController.getTree);

  router.get('/search', searchController.search);

  // --- admin — plan.md §9.7 ---------------------------------------------------
  router.get('/admin/products', ...requireCatalogRead(), productController.adminList);
  router.post('/admin/products', ...requireCatalogWrite(), productController.adminCreate);
  router.get('/admin/products/:id', ...requireCatalogRead(), productController.adminGet);
  router.patch('/admin/products/:id', ...requireCatalogWrite(), productController.adminUpdate);
  router.delete('/admin/products/:id', ...requireCatalogWrite(), productController.adminDelete);

  router.post('/admin/products/:id/variants', ...requireCatalogWrite(), variantController.create);
  router.patch('/admin/products/:id/variants/:variantId', ...requireCatalogWrite(), variantController.update);
  router.delete('/admin/products/:id/variants/:variantId', ...requireCatalogWrite(), variantController.remove);

  router.post('/admin/products/:id/media', ...requireCatalogWrite(), variantController.addMedia);

  router.get('/admin/brands', ...requireCatalogRead(), brandController.adminList);
  router.post('/admin/brands', ...requireCatalogWrite(), brandController.adminCreate);
  router.get('/admin/brands/:id', ...requireCatalogRead(), brandController.adminGet);
  router.patch('/admin/brands/:id', ...requireCatalogWrite(), brandController.adminUpdate);
  router.delete('/admin/brands/:id', ...requireCatalogWrite(), brandController.adminDelete);

  router.get('/admin/categories', ...requireCatalogRead(), categoryController.adminList);
  router.post('/admin/categories', ...requireCatalogWrite(), categoryController.adminCreate);
  router.get('/admin/categories/:id', ...requireCatalogRead(), categoryController.adminGet);
  router.patch('/admin/categories/:id', ...requireCatalogWrite(), categoryController.adminUpdate);
  router.delete('/admin/categories/:id', ...requireCatalogWrite(), categoryController.adminDelete);

  router.get('/admin/collections', ...requireCatalogRead(), collectionController.adminList);
  router.post('/admin/collections', ...requireCatalogWrite(), collectionController.adminCreate);
  router.get('/admin/collections/:id', ...requireCatalogRead(), collectionController.adminGet);
  router.patch('/admin/collections/:id', ...requireCatalogWrite(), collectionController.adminUpdate);
  router.delete('/admin/collections/:id', ...requireCatalogWrite(), collectionController.adminDelete);

  return router;
}
