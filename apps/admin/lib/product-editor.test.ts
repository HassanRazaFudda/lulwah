import { describe, expect, it } from 'vitest';
import { buildVariantMatrix, defaultPiecesForCount } from './product-editor';

describe('defaultPiecesForCount', () => {
  it('returns no rows for pieceCount null (not applicable)', () => {
    expect(defaultPiecesForCount(null, 'lawn')).toEqual([]);
  });

  it('1-piece: shirt only', () => {
    const pieces = defaultPiecesForCount(1, 'lawn');
    expect(pieces.map((p) => p.type)).toEqual(['shirt']);
  });

  it('2-piece: shirt + trouser', () => {
    const pieces = defaultPiecesForCount(2, 'khaddar');
    expect(pieces.map((p) => p.type)).toEqual(['shirt', 'trouser']);
  });

  it('3-piece: shirt + trouser + dupatta', () => {
    const pieces = defaultPiecesForCount(3, 'lawn');
    expect(pieces.map((p) => p.type)).toEqual(['shirt', 'trouser', 'dupatta']);
  });

  it('every generated piece uses the passed fabric and starts with no work/length/description', () => {
    const pieces = defaultPiecesForCount(3, 'chiffon');
    for (const piece of pieces) {
      expect(piece.fabric).toBe('chiffon');
      expect(piece.lengthMeters).toBeNull();
      expect(piece.work).toEqual([]);
      expect(piece.descriptionEn).toBe('');
      expect(piece.descriptionAr).toBe('');
    }
  });

  it('returns a fresh array each call — callers cannot mutate a shared table', () => {
    const first = defaultPiecesForCount(2, 'lawn');
    first.push({ type: 'shawl', fabric: 'lawn', lengthMeters: null, work: [], descriptionEn: '', descriptionAr: '' });
    const second = defaultPiecesForCount(2, 'lawn');
    expect(second).toHaveLength(2);
  });
});

describe('buildVariantMatrix', () => {
  it('returns the single base row when neither sizes nor colors are given', () => {
    const rows = buildVariantMatrix({ skuBase: 'khas-107', sizes: [], colors: [], basePriceFils: 18900, weightGrams: 350 });
    expect(rows).toEqual([{ size: undefined, color: undefined, sku: 'KHAS-107', priceFils: 18900, weightGrams: 350 }]);
  });

  it('varies by size only', () => {
    const rows = buildVariantMatrix({
      skuBase: 'khas-107',
      sizes: ['S', 'M', 'L'],
      colors: [],
      basePriceFils: 18900,
      weightGrams: 350,
    });
    expect(rows.map((r) => r.sku)).toEqual(['KHAS-107-S', 'KHAS-107-M', 'KHAS-107-L']);
    expect(rows.every((r) => r.color === undefined)).toBe(true);
  });

  it('varies by colour only', () => {
    const rows = buildVariantMatrix({
      skuBase: 'khas-107',
      sizes: [],
      colors: [{ name: 'Ferozi' }, { name: 'Off White' }],
      basePriceFils: 18900,
      weightGrams: 350,
    });
    expect(rows.map((r) => r.sku)).toEqual(['KHAS-107-FE', 'KHAS-107-OW']);
    expect(rows.every((r) => r.size === undefined)).toBe(true);
  });

  it('is the full cartesian product of sizes × colours, in row-major order', () => {
    const rows = buildVariantMatrix({
      skuBase: 'ss-041',
      sizes: ['XS', 'S'],
      colors: [{ name: 'Maroon' }, { name: 'Emerald' }],
      basePriceFils: 12000,
      weightGrams: 300,
    });
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => [r.size, r.color])).toEqual([
      ['XS', 'Maroon'],
      ['XS', 'Emerald'],
      ['S', 'Maroon'],
      ['S', 'Emerald'],
    ]);
    expect(rows.map((r) => r.sku)).toEqual(['SS-041-XS-MA', 'SS-041-XS-EM', 'SS-041-S-MA', 'SS-041-S-EM']);
  });

  it('every row inherits the given base price and weight', () => {
    const rows = buildVariantMatrix({
      skuBase: 'mb-019',
      sizes: ['M', 'L'],
      colors: [],
      basePriceFils: 27500,
      weightGrams: 420,
    });
    expect(rows.every((r) => r.priceFils === 27500 && r.weightGrams === 420)).toBe(true);
  });

  it('uppercases the SKU base regardless of input casing', () => {
    const rows = buildVariantMatrix({ skuBase: 'lf-0001', sizes: [], colors: [], basePriceFils: 100, weightGrams: 200 });
    expect(rows[0]?.sku).toBe('LF-0001');
  });

  it('produces a stable two-letter code for single-word colour names', () => {
    const rows = buildVariantMatrix({
      skuBase: 'x',
      sizes: [],
      colors: [{ name: 'Gold' }, { name: 'Black' }],
      basePriceFils: 1,
      weightGrams: 1,
    });
    expect(rows.map((r) => r.sku)).toEqual(['X-GO', 'X-BL']);
  });
});
