import type { DupattaType, Fabric, PieceCount, ProductPiece } from '@lulwah/contracts';
import { humanize } from './facets';

/**
 * Derived PDP copy for fields the real `Product` schema doesn't carry.
 *
 * `pieces[]` (the real per-piece breakdown) and a `fabricCare` paragraph
 * both exist in the placeholder catalogue's shape, but `Product`
 * (`@lulwah/contracts`) only kept `pieces[]` from that pair — and
 * `apps/api/scripts/seed.ts` never populates it (`AdminCreateProductInput`
 * defaults it to `[]`, and the seed data doesn't set it). Real seeded
 * products therefore always arrive with `pieces: []`; `fabricCare` was
 * never part of the contract at all. Both are reconstructed here from
 * fields that *do* exist (`pieceCount`, `fabric`, `dupattaType`) rather
 * than left blank — a labelled simplification, not fabricated per-product
 * detail (no invented yardages, no invented instructions beyond a
 * fabric-category default).
 */

const DELICATE_FABRICS: Fabric[] = [
  'chiffon',
  'organza',
  'silk',
  'raw_silk',
  'net',
  'tissue',
  'banarsi',
  'jamawar',
  'velvet',
  'crinkle_chiffon',
];

export function buildPiecesSummary(pieceCount: PieceCount | null, fabric: Fabric, dupattaType: DupattaType | null, pieces: ProductPiece[]): { type: string; fabric: string; lengthMeters: number | null }[] {
  if (pieces.length > 0) {
    return pieces.map((piece) => ({ type: piece.type, fabric: humanize(piece.fabric), lengthMeters: piece.lengthMeters }));
  }
  const fabricLabel = humanize(fabric);
  const hasDupatta = dupattaType !== null && dupattaType !== 'none';
  if (pieceCount === null || pieceCount === 1) {
    return [{ type: 'shirt', fabric: fabricLabel, lengthMeters: null }];
  }
  const summary = [
    { type: 'shirt', fabric: fabricLabel, lengthMeters: null },
    { type: 'trouser', fabric: fabricLabel, lengthMeters: null },
  ];
  if (pieceCount >= 3 && hasDupatta) {
    summary.push({ type: 'dupatta', fabric: humanize(dupattaType), lengthMeters: null });
  }
  return summary;
}

export function buildFabricCareLine(fabric: Fabric, secondaryFabrics: Fabric[], dupattaType: DupattaType | null): string {
  const fabricLabel = humanize(fabric);
  const secondaryLabel = secondaryFabrics.length > 0 ? ` with ${secondaryFabrics.map(humanize).join(', ')}` : '';
  const dupattaLabel = dupattaType && dupattaType !== 'none' ? `, ${humanize(dupattaType)} dupatta` : '';
  const care = DELICATE_FABRICS.includes(fabric) ? 'Dry clean only.' : 'Hand wash cold, dry in shade.';
  return `${fabricLabel}${secondaryLabel}${dupattaLabel}. ${care}`;
}
