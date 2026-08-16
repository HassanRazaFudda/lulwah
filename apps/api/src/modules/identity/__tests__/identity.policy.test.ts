import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/errors.js';
import { assertPermission, effectivePermissions, ROLE_PERMISSIONS } from '../identity.policy.js';
import type { AuthenticatedUser } from '../identity.policy.js';

/**
 * Fast, DB-free unit coverage for the RBAC matrix (plan.md §10.2) — no
 * Express, no Mongo. `assertPermission` is what `identity.service.ts`
 * calls a second time on top of route-level `requirePermission`, so this
 * is effectively testing the service-layer half of the "enforced by
 * middleware AND re-checked in the service layer" rule.
 */

function actor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { id: 'u1', role: 'customer', permissions: [], sessionId: 's1', ...overrides };
}

describe('ROLE_PERMISSIONS', () => {
  it('grants super_admin every declared permission', () => {
    expect(ROLE_PERMISSIONS.super_admin).toEqual(expect.arrayContaining(['users.write', 'settings.write', 'orders.status.update']));
  });

  it('grants the customer role no admin permissions at all — storefront only (plan.md §10.2)', () => {
    expect(ROLE_PERMISSIONS.customer).toEqual([]);
  });

  it("matches the plan's table for warehouse: inventory write, but only orders.read + orders.status.update as permission strings", () => {
    expect(ROLE_PERMISSIONS.warehouse).toEqual(
      expect.arrayContaining(['inventory.write', 'orders.status.update']),
    );
    expect(ROLE_PERMISSIONS.warehouse).not.toContain('refunds.write');
    expect(ROLE_PERMISSIONS.warehouse).not.toContain('settings.write');
  });
});

describe('effectivePermissions', () => {
  it("unions a role's bundle with the user's extra individual grants", () => {
    const permissions = effectivePermissions('catalog', ['reports.write']);
    expect(permissions).toEqual(expect.arrayContaining(['products.write', 'reports.write']));
  });

  it('de-duplicates when an extra grant overlaps the role bundle', () => {
    const permissions = effectivePermissions('catalog', ['products.write']);
    expect(permissions.filter((p) => p === 'products.write')).toHaveLength(1);
  });
});

describe('assertPermission', () => {
  it('passes silently when the user holds the permission', () => {
    expect(() => assertPermission(actor({ role: 'manager', permissions: ROLE_PERMISSIONS.manager as string[] }), 'products.write')).not.toThrow();
  });

  it('throws AUTH_FORBIDDEN (403) when the user lacks the permission', () => {
    try {
      assertPermission(actor({ role: 'customer', permissions: [] }), 'settings.write');
      expect.unreachable('expected assertPermission to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('AUTH_FORBIDDEN');
      expect((err as AppError).httpStatus).toBe(403);
    }
  });
});
