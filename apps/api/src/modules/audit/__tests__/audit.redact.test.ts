import { describe, expect, it } from 'vitest';
import { redactSecrets } from '../audit.redact.js';

describe('redactSecrets', () => {
  it('redacts obvious secret keys at the top level', () => {
    const result = redactSecrets({ email: 'a@b.com', password: 'hunter2', token: 'abc.def.ghi' }) as Record<string, unknown>;
    expect(result.email).toBe('a@b.com');
    expect(result.password).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
  });

  it('redacts nested secret keys inside objects and arrays', () => {
    const result = redactSecrets({
      user: { firstName: 'A', currentPassword: 'x', newPassword: 'y' },
      items: [{ sku: 'ABC', accessToken: 'zzz' }],
    }) as { user: Record<string, unknown>; items: Record<string, unknown>[] };
    expect(result.user.firstName).toBe('A');
    expect(result.user.currentPassword).toBe('[REDACTED]');
    expect(result.user.newPassword).toBe('[REDACTED]');
    expect(result.items[0]?.sku).toBe('ABC');
    expect(result.items[0]?.accessToken).toBe('[REDACTED]');
  });

  it('is case-insensitive and matches partial key names (PASSWORD, refreshToken, otpCode, cardNumber)', () => {
    const result = redactSecrets({ PASSWORD: 'a', refreshToken: 'b', otpCode: 'c', cardNumber: 'd', cvv: 'e' }) as Record<string, unknown>;
    expect(Object.values(result)).toEqual(['[REDACTED]', '[REDACTED]', '[REDACTED]', '[REDACTED]', '[REDACTED]']);
  });

  it('leaves non-secret primitives, null, and undefined untouched', () => {
    expect(redactSecrets('hello')).toBe('hello');
    expect(redactSecrets(42)).toBe(42);
    expect(redactSecrets(null)).toBeNull();
    expect(redactSecrets(undefined)).toBeUndefined();
    expect(redactSecrets(true)).toBe(true);
  });

  it('does not blow the stack on a deeply nested object — truncates past MAX_DEPTH', () => {
    let deep: unknown = 'leaf';
    for (let i = 0; i < 20; i += 1) deep = { nested: deep };
    expect(() => redactSecrets(deep)).not.toThrow();
  });

  it('caps array processing rather than iterating unbounded', () => {
    const bigArray = Array.from({ length: 500 }, (_, i) => i);
    const result = redactSecrets(bigArray) as unknown[];
    expect(result.length).toBeLessThanOrEqual(200);
  });

  // Regression coverage for a real bug found live during integration
  // testing (see `audit.redact.ts`'s doc comment): `Date` has no own
  // enumerable properties, so the generic object branch used to collapse
  // every `createdAt`/`updatedAt` into `{}`.
  it('passes a Date through untouched, at the top level and nested', () => {
    const now = new Date('2026-01-15T10:00:00.000Z');
    expect(redactSecrets(now)).toBe(now);

    const nested = redactSecrets({ id: '1', createdAt: now, updatedAt: now }) as { createdAt: unknown; updatedAt: unknown };
    expect(nested.createdAt).toBe(now);
    expect(nested.updatedAt).toBe(now);

    const inArray = redactSecrets([{ createdAt: now }]) as { createdAt: unknown }[];
    expect(inArray[0]?.createdAt).toBe(now);
  });

  // Regression coverage for the other real bug found live in the same
  // pass: a plain `/card/i` substring test redacted `Discount
  // .showOnProductCard` — a real merchandising flag, not a secret —
  // purely because "Card" appears inside "ProductCard".
  it('does NOT redact a key that merely contains "card" as a substring of a longer word', () => {
    const result = redactSecrets({ showOnProductCard: true, discardedAt: null, cardiganSize: 'M' }) as Record<string, unknown>;
    expect(result.showOnProductCard).toBe(true);
    expect(result.discardedAt).toBeNull();
    expect(result.cardiganSize).toBe('M');
  });

  it('DOES redact a real card-number-shaped field regardless of casing/separator', () => {
    const result = redactSecrets({ cardNumber: '4111111111111111', card_number: 'x', creditCard: 'y' }) as Record<string, unknown>;
    expect(result.cardNumber).toBe('[REDACTED]');
    expect(result.card_number).toBe('[REDACTED]');
    expect(result.creditCard).toBe('[REDACTED]');
  });
});
