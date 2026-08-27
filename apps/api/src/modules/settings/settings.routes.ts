import { Router } from 'express';
import * as controller from './settings.controller.js';
import { requireSettingsRead, requireSettingsWrite } from './settings.policy.js';

/**
 * HTTP wiring only (plan.md §5.4). Mounted at `API_PREFIX` by `app.ts`, so
 * routes below resolve to `/api/v1/admin/settings` (plan.md §9.7, §11.1).
 * A single document, no list/detail-by-id routes — `GET`/`PATCH` only.
 */
export function createSettingsRouter(): Router {
  const router = Router();

  router.get('/admin/settings', ...requireSettingsRead(), controller.adminGet);
  router.patch('/admin/settings', ...requireSettingsWrite(), controller.adminUpdate);

  return router;
}
