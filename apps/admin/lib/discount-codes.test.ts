import { describe, expect, it } from 'vitest';
import { buildCodesCsv, generateSequentialCodes } from './discount-codes';

describe('generateSequentialCodes', () => {
  it('generates the requested count, zero-padded, starting at 1 by default', () => {
    expect(generateSequentialCodes('EID', 3)).toEqual(['EID0001', 'EID0002', 'EID0003']);
  });

  it('uppercases and strips whitespace from the prefix', () => {
    expect(generateSequentialCodes('  influencer campaign ', 1)).toEqual(['INFLUENCERCAMPAIGN0001']);
  });

  it('respects a custom startAt', () => {
    expect(generateSequentialCodes('X', 2, 501)).toEqual(['X0501', 'X0502']);
  });

  it('respects a custom pad width, and overflows it without truncating the number', () => {
    expect(generateSequentialCodes('X', 1, 1, 2)).toEqual(['X01']);
    expect(generateSequentialCodes('X', 1, 12345, 2)).toEqual(['X12345']);
  });

  it('every code is unique within one batch', () => {
    const codes = generateSequentialCodes('BATCH', 500);
    expect(new Set(codes).size).toBe(500);
  });

  it('returns an empty array for count 0', () => {
    expect(generateSequentialCodes('X', 0)).toEqual([]);
  });
});

describe('buildCodesCsv', () => {
  it('builds a header row plus one row per result', () => {
    const csv = buildCodesCsv([
      { code: 'EID0001', status: 'created', discountId: 'abc123' },
      { code: 'EID0002', status: 'failed', error: 'A discount with this code already exists.' },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('code,status,discountId,error');
    expect(lines[1]).toBe('EID0001,created,abc123,');
    expect(lines[2]).toBe('EID0002,failed,,A discount with this code already exists.');
  });

  it('quotes fields containing commas, quotes, or newlines, doubling embedded quotes', () => {
    const csv = buildCodesCsv([{ code: 'EID0001', status: 'failed', error: 'Invalid, "weird" value\nline two' }]);
    expect(csv).toBe('code,status,discountId,error\nEID0001,failed,,"Invalid, ""weird"" value\nline two"');
  });

  it('produces just the header for an empty result set', () => {
    expect(buildCodesCsv([])).toBe('code,status,discountId,error');
  });
});
