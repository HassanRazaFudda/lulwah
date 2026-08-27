import { Router } from 'express';
import * as controller from './customer.controller.js';
import { requireCustomerRead, requireCustomerWrite } from './customer.policy.js';

/**
 * HTTP wiring only (plan.md §5.4). Mounted at `API_PREFIX` by `app.ts`, so
 * routes below resolve to `/api/v1/admin/customers*` (plan.md §11.1).
 */
export function createCustomerRouter(): Router {
  const router = Router();

  router.get('/admin/customers', ...requireCustomerRead(), controller.adminList);
  router.get('/admin/customers/:id', ...requireCustomerRead(), controller.adminGet);
  router.patch('/admin/customers/:id', ...requireCustomerWrite(), controller.adminUpdate);

  return router;
}
