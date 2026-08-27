import { Router } from 'express';
import * as controller from './audit.controller.js';
import { requireAuditRead } from './audit.policy.js';

/**
 * HTTP wiring only (plan.md §5.4). Mounted at `API_PREFIX` by `app.ts`, so
 * this resolves to `/api/v1/admin/audit-log` (plan.md §11.1).
 */
export function createAuditRouter(): Router {
  const router = Router();
  router.get('/admin/audit-log', ...requireAuditRead(), controller.list);
  return router;
}
