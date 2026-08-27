import { describe, expect, it } from 'vitest';
import { toCsv } from '../csv.js';

interface Row {
  name: string;
  amount: number;
  note: string | null;
}

describe('toCsv', () => {
  it('renders a header row and one line per data row, comma-separated', () => {
    const rows: Row[] = [
      { name: 'Lawn Suit', amount: 20000, note: null },
      { name: 'Wedding Set', amount: 15000, note: 'gift wrap' },
    ];
    const csv = toCsv(rows, [
      { header: 'Name', value: (r) => r.name },
      { header: 'Amount', value: (r) => r.amount },
      { header: 'Note', value: (r) => r.note },
    ]);
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toBe('Name,Amount,Note');
    expect(lines[1]).toBe('Lawn Suit,20000,');
    expect(lines[2]).toBe('Wedding Set,15000,gift wrap');
    expect(lines[3]).toBe(''); // trailing CRLF
  });

  it('starts with a UTF-8 BOM so Excel renders non-ASCII text correctly', () => {
    const csv = toCsv([{ name: 'a', amount: 1, note: null }], [{ header: 'Name', value: (r) => r.name }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('quotes and escapes a field containing a comma', () => {
    const csv = toCsv([{ name: 'Lawn, Embroidered', amount: 1, note: null }], [{ header: 'Name', value: (r) => r.name }]);
    expect(csv).toContain('"Lawn, Embroidered"');
  });

  it('quotes and doubles an embedded quote', () => {
    const csv = toCsv([{ name: 'The "Eid" Edit', amount: 1, note: null }], [{ header: 'Name', value: (r) => r.name }]);
    expect(csv).toContain('"The ""Eid"" Edit"');
  });

  it('quotes a field containing a newline', () => {
    const csv = toCsv([{ name: 'Line one\nLine two', amount: 1, note: null }], [{ header: 'Name', value: (r) => r.name }]);
    expect(csv).toContain('"Line one\nLine two"');
  });

  it('renders a Date as ISO 8601', () => {
    const date = new Date('2026-01-15T12:00:00.000Z');
    const csv = toCsv([{ at: date }], [{ header: 'At', value: (r: { at: Date }) => r.at }]);
    expect(csv).toContain('2026-01-15T12:00:00.000Z');
  });

  it('renders an empty rows array as just the header line', () => {
    const csv = toCsv([], [{ header: 'Name', value: () => '' }]);
    expect(csv.replace(/^\uFEFF/, '')).toBe('Name\r\n');
  });
});
