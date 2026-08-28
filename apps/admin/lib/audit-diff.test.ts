import { describe, expect, it } from 'vitest';
import { buildDiffRows } from './audit-diff';

describe('buildDiffRows', () => {
  it('marks an identical field on both sides as a match', () => {
    const rows = buildDiffRows({ status: 'shipped' }, { status: 'shipped' });
    expect(rows).toEqual([{ path: 'status', requestValue: 'shipped', responseValue: 'shipped', status: 'match' }]);
  });

  it('marks a field present with different values as "differs"', () => {
    const rows = buildDiffRows({ status: 'shipped' }, { status: 'delivered' });
    expect(rows).toEqual([
      { path: 'status', requestValue: 'shipped', responseValue: 'delivered', status: 'differs' },
    ]);
  });

  it('marks a field only on the response side as "responseOnly" — the normal case for a small request/large entity response', () => {
    const rows = buildDiffRows({ status: 'shipped' }, { status: 'shipped', orderNumber: 'LF-260101-0001' });
    const orderNumberRow = rows.find((r) => r.path === 'orderNumber');
    expect(orderNumberRow).toEqual({
      path: 'orderNumber',
      requestValue: undefined,
      responseValue: 'LF-260101-0001',
      status: 'responseOnly',
    });
  });

  it('marks a field only on the request side as "requestOnly"', () => {
    const rows = buildDiffRows({ internalOnlyFlag: true }, { status: 'ok' });
    const flagRow = rows.find((r) => r.path === 'internalOnlyFlag');
    expect(flagRow).toEqual({
      path: 'internalOnlyFlag',
      requestValue: 'true',
      responseValue: undefined,
      status: 'requestOnly',
    });
  });

  it('represents a genuinely empty side as its own "(root)" row rather than silently dropping it', () => {
    const rows = buildDiffRows({ internalOnlyFlag: true }, {});
    expect(rows).toEqual([
      { path: '(root)', requestValue: undefined, responseValue: '{}', status: 'responseOnly' },
      { path: 'internalOnlyFlag', requestValue: 'true', responseValue: undefined, status: 'requestOnly' },
    ]);
  });

  it('flattens nested objects with dot-paths', () => {
    const rows = buildDiffRows({ address: { city: 'Dubai' } }, { address: { city: 'Dubai' } });
    expect(rows).toEqual([
      { path: 'address.city', requestValue: 'Dubai', responseValue: 'Dubai', status: 'match' },
    ]);
  });

  it('flattens array items with bracket-index paths', () => {
    const rows = buildDiffRows({ tags: ['vip'] }, { tags: ['vip', 'risky_cod'] });
    expect(rows).toEqual([
      { path: 'tags[0]', requestValue: 'vip', responseValue: 'vip', status: 'match' },
      { path: 'tags[1]', requestValue: undefined, responseValue: 'risky_cod', status: 'responseOnly' },
    ]);
  });

  it('handles an empty request body without throwing', () => {
    const rows = buildDiffRows(undefined, { id: '123' });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.status !== 'match' || r.requestValue !== undefined)).toBe(true);
  });

  it('sorts rows by path', () => {
    const rows = buildDiffRows({ b: 1, a: 2 }, { b: 1, a: 2 });
    expect(rows.map((r) => r.path)).toEqual(['a', 'b']);
  });
});
