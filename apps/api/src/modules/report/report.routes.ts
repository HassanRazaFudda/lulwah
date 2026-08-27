import { Router } from 'express';
import * as controller from './report.controller.js';
import { requireReportRead } from './report.policy.js';

/**
 * HTTP wiring only (plan.md §5.4). Mounted at `API_PREFIX` by `app.ts`, so
 * routes below resolve to `/api/v1/admin/reports/*` (plan.md §11.1's
 * Reports screen). Every route requires `reports.read`; `?format=csv`
 * additionally requires `reports.write`, re-checked in the controller
 * (see `report.policy.ts`'s doc comment).
 *
 * Two categories from plan.md §11.1's Reports row are NOT routed here:
 *  - **Traffic** (GA4 API) — no analytics integration exists in this repo
 *    at all (plan.md §23 was never built). Not attempted.
 *  - **Search** IS routed (`/admin/reports/search`) — see
 *    `catalog/search.service.ts`'s doc comment for the minimal
 *    query-logging hook that makes it real data, not a skip.
 */
export function createReportRouter(): Router {
  const router = Router();

  router.get('/admin/reports/sales', ...requireReportRead(), controller.sales);
  router.get('/admin/reports/products', ...requireReportRead(), controller.products);
  router.get('/admin/reports/customers', ...requireReportRead(), controller.customers);
  router.get('/admin/reports/discounts', ...requireReportRead(), controller.discounts);
  router.get('/admin/reports/inventory', ...requireReportRead(), controller.inventory);
  router.get('/admin/reports/search', ...requireReportRead(), controller.search);

  return router;
}
