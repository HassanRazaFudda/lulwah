import { describe, expect, it } from 'vitest';
import { deriveAuditMeta } from '../audit.path.js';

/** Pure unit coverage for the route → action/entityType/entityId
 *  derivation, exercised against real route shapes from every admin
 *  router in this codebase (`order`, `catalog`, `inventory`, `pricing`,
 *  `identity`), not invented ones. */
describe('deriveAuditMeta', () => {
  it('derives entityType/entityId/action for a collection-level create route', () => {
    const result = deriveAuditMeta('POST', '/admin/discounts');
    expect(result).toEqual({ action: 'POST /admin/discounts', entityType: 'discounts', entityId: null });
  });

  it('derives entityType/entityId for a single-id route', () => {
    const id = '64f0a1b2c3d4e5f6a7b8c9d0';
    const result = deriveAuditMeta('PATCH', `/admin/products/${id}`);
    expect(result).toEqual({ action: 'PATCH /admin/products/:id', entityType: 'products', entityId: id });
  });

  it('derives entityType/entityId for a nested sub-resource route (status/notes/adjust/toggle)', () => {
    const id = '64f0a1b2c3d4e5f6a7b8c9d0';
    expect(deriveAuditMeta('PATCH', `/admin/orders/${id}/status`)).toEqual({
      action: 'PATCH /admin/orders/:id/status',
      entityType: 'orders',
      entityId: id,
    });
    expect(deriveAuditMeta('POST', `/admin/orders/${id}/notes`)).toEqual({
      action: 'POST /admin/orders/:id/notes',
      entityType: 'orders',
      entityId: id,
    });
    expect(deriveAuditMeta('POST', `/admin/inventory/${id}/adjust`)).toEqual({
      action: 'POST /admin/inventory/:id/adjust',
      entityType: 'inventory',
      entityId: id,
    });
    expect(deriveAuditMeta('POST', `/admin/discounts/${id}/toggle`)).toEqual({
      action: 'POST /admin/discounts/:id/toggle',
      entityType: 'discounts',
      entityId: id,
    });
  });

  it('normalizes the same action label regardless of which id is hit', () => {
    const a = deriveAuditMeta('DELETE', '/admin/products/64f0a1b2c3d4e5f6a7b8c9d0');
    const b = deriveAuditMeta('DELETE', '/admin/products/000000000000000000000000');
    expect(a.action).toBe(b.action);
  });

  it('handles a deeper nested route (product variants/media)', () => {
    const productId = '64f0a1b2c3d4e5f6a7b8c9d0';
    const variantId = '64f0a1b2c3d4e5f6a7b8c9d1';
    const result = deriveAuditMeta('PATCH', `/admin/products/${productId}/variants/${variantId}`);
    expect(result.entityType).toBe('products');
    // First ObjectId-shaped segment wins — a documented simplification for
    // the (currently nonexistent) two-id case.
    expect(result.entityId).toBe(productId);
    expect(result.action).toBe('PATCH /admin/products/:id/variants/:id');
  });

  it('is not fooled by a non-ObjectId path segment (e.g. "role")', () => {
    const id = '64f0a1b2c3d4e5f6a7b8c9d0';
    const result = deriveAuditMeta('PATCH', `/admin/users/${id}/role`);
    expect(result).toEqual({ action: 'PATCH /admin/users/:id/role', entityType: 'users', entityId: id });
  });

  it('returns null entityId when nothing ObjectId-shaped is present', () => {
    const result = deriveAuditMeta('POST', '/admin/brands');
    expect(result.entityId).toBeNull();
  });
});
